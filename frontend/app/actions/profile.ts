"use server";

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { User, UserIdentity } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  profileDeleteSchema,
  profilePasswordSchema,
  profileSchema,
} from "@/app/schemas/profile";
import { isUsernameTaken } from "@/lib/auth/queries";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type ProfileMessage = {
  ok: boolean;
  message?: string;
};

function getAuthProvider(user: User) {
  return typeof user.app_metadata?.provider === "string"
    ? user.app_metadata.provider
    : "email";
}

function getIdentityProviders(user: User) {
  return new Set((user.identities ?? []).map((identity: UserIdentity) => identity.provider));
}

function isPasswordAccount(user: User) {
  const providers = getIdentityProviders(user);
  return providers.has("email") || getAuthProvider(user) === "email";
}

function mapUpdatePasswordError(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes("password")) {
    return "Не вдалося оновити пароль.";
  }
  return "Не вдалося зберегти зміни.";
}

function createStatelessAuthClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function updateProfileAction(
  _prevState: ProfileMessage | undefined,
  formData: FormData,
): Promise<ProfileMessage> {
  const parsed = profileSchema.safeParse({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    username: String(formData.get("username") ?? ""),
    role: String(formData.get("role") ?? ""),
    region: String(formData.get("region") ?? ""),
    city: String(formData.get("city") ?? ""),
    bio: String(formData.get("bio") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесію завершено. Увійдіть ще раз." };
  }

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("username, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !currentProfile) {
    return { ok: false, message: "Не вдалося завантажити профіль." };
  }

  if (currentProfile.username.toLowerCase() !== parsed.data.username.trim().toLowerCase()) {
    try {
      const taken = await isUsernameTaken(parsed.data.username);
      if (taken) {
        return { ok: false, message: "Цей логін уже зайнятий." };
      }
    } catch {
      return { ok: false, message: "Не вдалося перевірити логін." };
    }
  }

  let nextAvatarPath = currentProfile.avatar_path ?? null;
  const avatar = formData.get("avatar");
  const removeAvatar = String(formData.get("removeAvatar") ?? "") === "true";

  if (removeAvatar && currentProfile.avatar_path) {
    await supabase.storage.from("profile-images").remove([currentProfile.avatar_path]);
    nextAvatarPath = null;
  }

  if (avatar instanceof File && avatar.size > 0) {
    const extension = avatar.name.includes(".") ? avatar.name.split(".").pop()?.toLowerCase() : "jpg";
    const safeExtension = extension && extension.length <= 5 ? extension : "jpg";
    const nextPath = `${user.id}/${randomUUID()}.${safeExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(nextPath, avatar, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, message: "Не вдалося завантажити фото профілю." };
    }

    if (currentProfile.avatar_path && currentProfile.avatar_path !== nextPath) {
      await supabase.storage.from("profile-images").remove([currentProfile.avatar_path]);
    }

    nextAvatarPath = nextPath;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username.trim(),
      first_name: parsed.data.firstName.trim(),
      last_name: parsed.data.lastName.trim(),
      role: parsed.data.role,
      region: parsed.data.region || null,
      city: parsed.data.city || null,
      bio: parsed.data.bio,
      avatar_path: nextAvatarPath,
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: "Не вдалося зберегти профіль." };
  }

  return { ok: true, message: "Профіль оновлено." };
}

export async function updatePasswordAction(
  _prevState: ProfileMessage | undefined,
  formData: FormData,
): Promise<ProfileMessage> {
  const parsed = profilePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесію завершено. Увійдіть ще раз." };
  }

  if (!isPasswordAccount(user) || !user.email) {
    return { ok: false, message: "Для цього акаунта пароль змінюється через провайдера входу." };
  }

  const verifier = createStatelessAuthClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (verifyError) {
    return { ok: false, message: "Невірний поточний пароль." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    return { ok: false, message: mapUpdatePasswordError(error.message) };
  }

  return { ok: true, message: "Пароль оновлено." };
}

export async function deleteAccountAction(
  _prevState: ProfileMessage | undefined,
  formData: FormData,
): Promise<ProfileMessage> {
  const parsed = profileDeleteSchema.safeParse({
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесію завершено. Увійдіть ще раз." };
  }

  if (!isPasswordAccount(user) || !user.email) {
    return {
      ok: false,
      message: "Видалення через пароль доступне лише для акаунта з входом через email/password.",
    };
  }

  const verifier = createStatelessAuthClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });

  if (verifyError) {
    return { ok: false, message: "Невірний пароль." };
  }

  const admin = createServiceRoleClient();
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfile?.avatar_path) {
    await supabase.storage.from("profile-images").remove([currentProfile.avatar_path]);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return { ok: false, message: "Не вдалося видалити акаунт. Спробуйте ще раз." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
