import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BLOCKED_BY_ADMIN_ERROR = "blocked_by_admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_blocked")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_blocked === true) {
          await supabase.auth.signOut();

          const loginUrl = new URL("/login", url.origin);
          loginUrl.searchParams.set("error", BLOCKED_BY_ADMIN_ERROR);
          return NextResponse.redirect(loginUrl);
        }
      }
    }
  }

  const safePath = nextPath.startsWith("/") ? nextPath : "/";
  return NextResponse.redirect(new URL(safePath, url.origin));
}
