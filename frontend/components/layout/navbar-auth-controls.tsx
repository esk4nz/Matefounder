"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavbarUserMenu } from "@/components/layout/navbar-user-menu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialEmail: string | null;
  initialDisplayName: string | null;
};

export function NavbarAuthControls({ initialEmail, initialDisplayName }: Props) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [displayName, setDisplayName] = useState<string | null>(initialDisplayName);

  useEffect(() => {
    const supabase = createClient();

    async function syncAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        setEmail(null);
        setDisplayName(null);
        return;
      }

      let nextDisplayName = user.email;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.username) {
        nextDisplayName = profile.username;
      }

      setEmail(user.email);
      setDisplayName(nextDisplayName);
    }

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncAuthState();
    });

    return () => subscription.unsubscribe();
  }, [initialDisplayName, initialEmail, pathname]);

  if (email && displayName) {
    return <NavbarUserMenu displayName={displayName} />;
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
      <Button
        asChild
        variant="ghost"
        className="h-11 rounded-xl px-5 text-base font-bold text-slate-700 hover:text-blue-600"
      >
        <Link href="/login">Увійти</Link>
      </Button>

      <Button asChild className="h-11 rounded-xl px-6 text-base font-bold shadow-none">
        <Link href="/signup">Реєстрація</Link>
      </Button>
    </div>
  );
}
