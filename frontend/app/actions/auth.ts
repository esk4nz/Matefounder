"use server";

import { redirect } from "next/navigation";
import { loginSchema, registerSchema } from "@/app/schemas/auth";
import { isUsernameTaken, resolveLoginEmail } from "@/lib/auth/queries";
import { createClient } from "@/lib/supabase/server";

export type AuthMessage = {
  ok: boolean;
  message?: string;
  code?: "blocked_by_admin";
};

function mapSignupError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists")
  ) {
    return "Цей email уже зареєстрований.";
  }
  if (lower.includes("password")) {
    return "Пароль не відповідає вимогам безпеки.";
  }
  return "Не вдалося створити акаунт. Спробуйте ще раз.";
}

export async function loginAction(
  _prevState: AuthMessage | undefined,
  formData: FormData,
): Promise<AuthMessage> {
  const parsed = loginSchema.safeParse({
    identifier: String(formData.get("identifier") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  let email: string | null;
  try {
    email = await resolveLoginEmail(parsed.data.identifier);
  } catch {
    return {
      ok: false,
      message:
        "Не вдалося перевірити облікові дані. Спробуйте ще раз або увійдіть через email.",
    };
  }

  if (!email) {
    return { ok: false, message: "Невірний логін або пароль." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, message: "Невірний логін або пароль." };
  }

  const userId = data.user?.id;
  if (!userId) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Не вдалося завершити вхід. Спробуйте ще раз.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_blocked")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Не вдалося перевірити статус акаунта. Спробуйте ще раз.",
    };
  }

  if (profile?.is_blocked === true) {
    await supabase.auth.signOut();
    return {
      ok: false,
      code: "blocked_by_admin",
      message: "Ваш акаунт заблокований адміністрацією.",
    };
  }

  redirect("/");
}

export async function signupAction(
  _prevState: AuthMessage | undefined,
  formData: FormData,
): Promise<AuthMessage> {
  const parsed = registerSchema.safeParse({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  try {
    const taken = await isUsernameTaken(parsed.data.username);
    if (taken) {
      return { ok: false, message: "Цей логін уже зайнятий." };
    }
  } catch {
    return {
      ok: false,
      message: "Не вдалося перевірити логін. Спробуйте ще раз.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    options: {
      data: {
        username: parsed.data.username,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  });

  if (error) {
    return { ok: false, message: mapSignupError(error.message) };
  }

  if (!data.session) {
    return {
      ok: false,
      message: "Не вдалося завершити реєстрацію. Спробуйте ще раз або увійдіть.",
    };
  }

  redirect("/profile");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
