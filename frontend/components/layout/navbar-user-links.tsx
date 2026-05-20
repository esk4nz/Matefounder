"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { subscribeNavbarSync } from "@/lib/navbar-sync";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialUserId: string | undefined;
};

export function NavbarUserLinks({ initialUserId }: Props) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(initialUserId ?? null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function syncAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!cancelled) {
        setUserId(user?.id ?? null);
      }
    }

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncAuthState();
    });

    const unsubscribeNavbarSync = subscribeNavbarSync(() => {
      void syncAuthState();
    });

    return () => {
      cancelled = true;
      unsubscribeNavbarSync();
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (!userId) {
    return null;
  }

  return (
    <>
      <Link
        href="/my-listings"
        className="text-base hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
      >
        Мої оголошення
      </Link>
      <Link
        href="/my-requests"
        className="text-base hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
      >
        Мої заявки
      </Link>
      <Link
        href={`/profile/${userId}/reviews`}
        className="text-base hover:text-blue-600 transition-colors whitespace-nowrap cursor-pointer"
      >
        Відгуки
      </Link>
    </>
  );
}
