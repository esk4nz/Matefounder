"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  displayName: string;
};

function initialsFromDisplay(displayName: string) {
  const cleaned = displayName.replace(/[^a-zA-ZА-Яа-яІіЇїЄєҐґ0-9]/g, "");
  const base =
    cleaned.length >= 2 ? cleaned.slice(0, 2) : (displayName.slice(0, 2) || "?");
  return base.toUpperCase();
}

export function NavbarUserMenu({ displayName }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div ref={rootRef} className="relative ml-auto flex items-center gap-3">
      <button
        type="button"
        aria-label={`Меню акаунта ${displayName}`}
        className={cn(
          "flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2 py-1 pr-3 text-sm font-bold text-slate-800 shadow-sm cursor-pointer",
          "hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
          {initialsFromDisplay(displayName)}
        </span>
        <span className="hidden max-w-[140px] truncate text-left sm:inline">{displayName}</span>
        <ChevronDown className={cn("size-4 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl border border-blue-100 bg-white py-1 text-sm shadow-lg"
        >
          <Link
            role="menuitem"
            href="/profile"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "flex h-auto w-full justify-start rounded-none px-3 py-2 font-medium text-slate-800 shadow-none cursor-pointer",
            )}
            onClick={() => setOpen(false)}
          >
            Профіль
          </Link>
          <Link
            role="menuitem"
            href="/how-it-works"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "flex h-auto w-full justify-start rounded-none px-3 py-2 font-medium text-slate-800 shadow-none cursor-pointer",
            )}
            onClick={() => setOpen(false)}
          >
            Допомога
          </Link>
          <form action={signOutAction} className="border-t border-blue-50">
            <button
              type="submit"
              role="menuitem"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "flex h-auto w-full justify-start rounded-none px-3 py-2 text-left font-medium text-red-700 shadow-none hover:bg-red-50 hover:text-red-700 cursor-pointer",
              )}
            >
              Вийти
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
