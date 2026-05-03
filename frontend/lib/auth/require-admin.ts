import { createClient } from "@/lib/supabase/server";

export type AdminGate =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

export async function requireAdminSession(): Promise<AdminGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_admin !== true) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, userId: user.id };
}
