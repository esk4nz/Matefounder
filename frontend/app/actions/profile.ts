"use server";

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type NormalizedProfileValues,
  PROFILE_TAG_CATALOG_CHANGED_MESSAGE,
  buildInitialTagFormState,
  createProfileFormSchema,
  flattenProfileTagIds,
  isTagPayloadConsistentWithIds,
  profileDeleteSchema,
  profilePasswordSchema,
  profileSetPasswordSchema,
} from "@/app/schemas/profile";
import { isUsernameTaken } from "@/lib/auth/queries";
import { userHasPassword } from "@/lib/auth/user";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type ProfileMessage = {
  ok: boolean;
  message?: string;
  reason?: "unauthenticated" | "stale_auth_session" | "missingProfile" | "adminAccount";
  profile?: NormalizedProfileValues & {
    avatarUrl: string | null;
    selectedTagIds: number[];
    updatedAt: string;
  };
};

const STALE_AUTH_SESSION_MESSAGE =
  "Ваша сесія застаріла. Будь ласка, спробуйте увійти знову.";

function staleAuthSessionResponse(): ProfileMessage {
  return {
    ok: false,
    message: STALE_AUTH_SESSION_MESSAGE,
    reason: "stale_auth_session",
  };
}

const PROFILE_STALE_VERSION_MESSAGE =
  "Дані застаріли. Будь ласка, оновіть сторінку, щоб побачити актуальні зміни.";

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

function parseProfileTagIdsFromForm(formData: FormData): number[] | null {
  const raw = formData.get("tagIds");
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((x) => Number.isInteger(x))) {
      return null;
    }
    return [...new Set(parsed as number[])];
  } catch {
    return null;
  }
}

export async function updateProfileAction(
  _prevState: ProfileMessage | undefined,
  formData: FormData,
): Promise<ProfileMessage> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return staleAuthSessionResponse();
  }

  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "").trim();
  if (!expectedUpdatedAt) {
    return { ok: false, message: "Некоректні дані версії профілю. Оновіть сторінку." };
  }

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("username, avatar_path, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !currentProfile) {
    return { ok: false, message: "Не вдалося завантажити профіль.", reason: "missingProfile" };
  }

  if (currentProfile.updated_at !== expectedUpdatedAt) {
    return { ok: false, message: PROFILE_STALE_VERSION_MESSAGE };
  }

  const { data: tagRowsRaw, error: tagsLoadError } = await supabase
    .from("tags")
    .select(TAGS_WITH_CATEGORY_SELECT);

  const allTagRows = mapTagsQueryToProfileRows(tagRowsRaw);

  if (tagsLoadError || !allTagRows.length) {
    return { ok: false, message: "Не вдалося завантажити теги." };
  }

  const uniqueIds = parseProfileTagIdsFromForm(formData);
  if (!uniqueIds) {
    return { ok: false, message: "Некоректні дані тегів." };
  }

  const expanded = buildInitialTagFormState(allTagRows, uniqueIds);
  if (!isTagPayloadConsistentWithIds(allTagRows, uniqueIds, expanded)) {
    return { ok: false, message: PROFILE_TAG_CATALOG_CHANGED_MESSAGE };
  }

  const profileSchema = createProfileFormSchema(allTagRows);
  const parsed = profileSchema.safeParse({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    username: String(formData.get("username") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactTelegram: String(formData.get("contactTelegram") ?? ""),
    tagSelections: expanded.tagSelections,
    tagInterests: expanded.tagInterests,
  });

  if (!parsed.success) {
    return { ok: false };
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

  const { data: updatedProfileRows, error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username.trim(),
      first_name: parsed.data.firstName.trim(),
      last_name: parsed.data.lastName.trim(),
      bio: parsed.data.bio,
      gender: parsed.data.gender,
      contact_phone: parsed.data.contactPhone,
      contact_telegram: parsed.data.contactTelegram || null,
      avatar_path: nextAvatarPath,
    })
    .eq("id", user.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");

  if (profileUpdateError) {
    return { ok: false, message: "Не вдалося зберегти профіль." };
  }
  if (!updatedProfileRows?.length) {
    return { ok: false, message: PROFILE_STALE_VERSION_MESSAGE };
  }

  const nextUpdatedAt = updatedProfileRows[0].updated_at;

  const nextTagIds = flattenProfileTagIds(parsed.data);

  const { error: deleteTagsError } = await supabase.from("profile_tags").delete().eq("profile_id", user.id);

  if (deleteTagsError) {
    return { ok: false, message: "Не вдалося оновити теги профілю." };
  }

  if (nextTagIds.length > 0) {
    const { error: insertTagsError } = await supabase.from("profile_tags").insert(
      nextTagIds.map((tag_id) => ({
        profile_id: user.id,
        tag_id,
      })),
    );

    if (insertTagsError) {
      return { ok: false, message: "Не вдалося зберегти теги профілю." };
    }
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");

  const avatarUrl = nextAvatarPath
    ? supabase.storage.from("profile-images").getPublicUrl(nextAvatarPath).data.publicUrl
    : null;

  return {
    ok: true,
    message: "Профіль оновлено.",
    profile: {
      username: parsed.data.username.trim(),
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      gender: parsed.data.gender,
      bio: parsed.data.bio,
      contactPhone: parsed.data.contactPhone,
      contactTelegram: parsed.data.contactTelegram,
      tagSelections: parsed.data.tagSelections,
      tagInterests: parsed.data.tagInterests,
      avatarUrl,
      selectedTagIds: nextTagIds,
      updatedAt: nextUpdatedAt,
    },
  };
}

export async function updatePasswordAction(
  _prevState: ProfileMessage | undefined,
  formData: FormData,
): Promise<ProfileMessage> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return staleAuthSessionResponse();
  }

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !currentProfile) {
    return { ok: false, message: "Не вдалося завантажити профіль.", reason: "missingProfile" };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const hasPassword = userHasPassword(user);

  if (hasPassword) {
    const parsed = profilePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!parsed.success) {
      return { ok: false };
    }

    if (!user.email) {
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

  const parsed = profileSetPasswordSchema.safeParse({
    newPassword,
    confirmPassword,
  });

  if (!parsed.success) {
    return { ok: false };
  }

  if (!user.email) {
    return { ok: false, message: "Для цього акаунта пароль змінюється через провайдера входу." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
    data: {
      ...user.user_metadata,
      has_password: true,
    },
  });

  if (error) {
    return { ok: false, message: mapUpdatePasswordError(error.message) };
  }

  return { ok: true, message: "Пароль встановлено." };
}

export async function deleteAccountAction(
  _prevState: ProfileMessage | undefined,
  formData: FormData,
): Promise<ProfileMessage> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return staleAuthSessionResponse();
  }

  const admin = createServiceRoleClient();
  const { data: currentProfile, error: profileError } = await admin
    .from("profiles")
    .select("avatar_path, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !currentProfile) {
    return { ok: false, message: "Не вдалося завантажити профіль.", reason: "missingProfile" };
  }

  if (currentProfile.is_admin) {
    return {
      ok: false,
      message: PROFILE_STALE_VERSION_MESSAGE,
      reason: "adminAccount",
    };
  }

  if (!userHasPassword(user) || !user.email) {
    return {
      ok: false,
      message: "Видалення через пароль доступне лише для акаунта з входом через email/password.",
    };
  }

  const parsed = profileDeleteSchema.safeParse({
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  const verifier = createStatelessAuthClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });

  if (verifyError) {
    return { ok: false, message: "Невірний пароль." };
  }

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
