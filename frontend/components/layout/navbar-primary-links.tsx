"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subscribeNavbarSync } from "@/lib/navbar-sync";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialUserId: string | undefined;
  initialIsAdmin: boolean;
};

type NavLinkItem = {
  href: string;
  label: string;
};

export function NavbarPrimaryLinks({ initialUserId, initialIsAdmin }: Props) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(initialUserId ?? null);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function syncNavState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        if (!cancelled) {
          setUserId(null);
          setIsAdmin(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setUserId(user.id);
        setIsAdmin(profile?.is_admin === true);
      }
    }

    void syncNavState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncNavState();
    });

    const unsubscribeNavbarSync = subscribeNavbarSync(() => {
      void syncNavState();
    });

    return () => {
      cancelled = true;
      unsubscribeNavbarSync();
      subscription.unsubscribe();
    };
  }, [pathname]);

  const items = useMemo(() => {
    const nextItems: NavLinkItem[] = [{ href: "/listings", label: "Оголошення" }];

    if (userId) {
      nextItems.push(
        { href: "/my-listings", label: "Мої оголошення" },
        { href: "/my-requests", label: "Мої заявки" },
        { href: `/profile/${userId}/reviews`, label: "Відгуки" },
      );
    }

    if (isAdmin) {
      nextItems.push(
        { href: "/admin", label: "Консоль адміністрування" },
        { href: "/admin/complaints", label: "Скарги" },
      );
    }

    return nextItems;
  }, [isAdmin, userId]);

  return (
    <>
      <div className="hidden items-center gap-x-6 font-bold text-slate-600 xl:flex xl:gap-x-8">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="cursor-pointer whitespace-nowrap text-base transition-colors hover:text-blue-600"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-xl px-4 text-base font-bold text-slate-700 hover:text-blue-600 xl:hidden"
            aria-label="Відкрити навігацію"
          >
            <Menu className="size-5" aria-hidden />
            Меню
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[min(24rem,calc(100vh-7rem))] w-[min(20rem,calc(100vw-2rem))] overflow-x-hidden overflow-y-auto xl:hidden"
        >
          {items.map((item, index) => (
            <div key={item.href}>
              {index === 1 && userId ? <DropdownMenuSeparator /> : null}
              {((userId && isAdmin && index === 4) || (!userId && isAdmin && index === 1)) ? (
                <DropdownMenuSeparator />
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={item.href} className="cursor-pointer">
                  {item.label}
                </Link>
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
