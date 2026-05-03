import Link from "next/link";
import { NavbarAdminLinks } from "@/components/layout/navbar-admin-links";
import { NavbarAuthControls } from "@/components/layout/navbar-auth-controls";
import { createClient } from "@/lib/supabase/server";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let navLabel = user?.email ?? "";
  let isAdmin = false;
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.username) {
      navLabel = profile.username;
    }
    isAdmin = profile?.is_admin === true;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-blue-200 bg-[#D8E9FF]/90 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto w-full flex min-h-[4.5rem] flex-wrap items-center justify-between gap-x-6 px-6 py-3">
        <div className="flex items-center gap-x-8 md:gap-x-12">
          <Link
            href="/"
            className="text-2xl font-black tracking-tighter text-slate-900 uppercase shrink-0 cursor-pointer"
          >
            Mate<span className="text-blue-600">founder</span>
          </Link>

          <div className="flex flex-wrap items-center gap-x-6 md:gap-x-8 font-bold text-slate-600">
            <Link
              href="/listings"
              className="text-base hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
            >
              Оголошення
            </Link>
            <Link
              href="/how-it-works"
              className="text-base hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
            >
              Як це працює
            </Link>
            <NavbarAdminLinks initialIsAdmin={isAdmin} hasUser={Boolean(user?.id)} />
          </div>
        </div>

        <NavbarAuthControls initialEmail={user?.email ?? null} initialDisplayName={navLabel || null} />
      </div>
    </nav>
  );
}
