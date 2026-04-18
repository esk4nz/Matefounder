import Link from "next/link";
import { NavbarUserMenu } from "@/components/layout/navbar-user-menu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let navLabel = user?.email ?? "";
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.username) {
      navLabel = profile.username;
    }
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
          </div>
        </div>

        {user?.email ? (
          <NavbarUserMenu displayName={navLabel} email={user.email} />
        ) : (
          <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
            <Button
              asChild
              variant="ghost"
              className="h-11 rounded-xl px-5 text-base font-bold text-slate-700 hover:text-blue-600"
            >
              <Link href="/login">Увійти</Link>
            </Button>

            <Button
              asChild
              className="h-11 rounded-xl px-6 text-base font-bold shadow-none"
            >
              <Link href="/signup">Реєстрація</Link>
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
