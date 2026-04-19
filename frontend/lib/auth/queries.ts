import { createServiceRoleClient } from "@/lib/supabase/admin";

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return null;
  }

  if (looksLikeEmail(trimmed)) {
    return trimmed.toLowerCase();
  }

  const admin = createServiceRoleClient();

  const exact = await admin.from("profiles").select("id").eq("username", trimmed).maybeSingle();

  const profileId =
    exact.data?.id ??
    (
      await admin.from("profiles").select("id").ilike("username", trimmed).maybeSingle()
    ).data?.id;

  if (!profileId) {
    return null;
  }

  const { data, error } = await admin.auth.admin.getUserById(profileId);
  if (error || !data.user.email) {
    return null;
  }

  return data.user.email;
}

export async function isUsernameTaken(trimmedUsername: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("username_is_taken", {
    candidate: trimmedUsername.trim(),
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}
