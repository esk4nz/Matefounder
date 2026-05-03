"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeNavbarSync } from "@/lib/navbar-sync";

type Props = {
  initialIsAdmin: boolean;
  hasUser: boolean;
};

export function NavbarAdminLinks({ initialIsAdmin, hasUser }: Props) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  useEffect(() => {
    if (!hasUser) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function refreshAdminRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setIsAdmin(profile?.is_admin === true);
      }
    }

    void refreshAdminRole();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshAdminRole();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAdminRole();
    });

    document.addEventListener("visibilitychange", onVisible);

    const onNavbarSync = () => {
      void refreshAdminRole();
    };
    const unsubscribeNavbarSync = subscribeNavbarSync(onNavbarSync);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribeNavbarSync();
      subscription.unsubscribe();
    };
  }, [hasUser, pathname]);

  if (!isAdmin) return null;

  return (
    <>
      <Link
        href="/admin"
        className="text-base hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
      >
        Консоль адміністрування
      </Link>
      <Link
        href="/admin/complaints"
        className="text-base hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
      >
        Скарги
      </Link>
    </>
  );
}
