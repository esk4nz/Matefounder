import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./config";

/** Лише на сервері: пошук профілю за логіном без публічного RPC. */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only)");
  }
  return createClient(getSupabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
