"use client";

import { AlertTriangle, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dispatchNavbarSync } from "@/lib/navbar-sync";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  profile_not_found:
    "Ой! Ваш профіль не знайдено. Спробуйте зайти знову",
  admin_required:
    "Доступ до консолі адміністрування для цього сеансу скасовано (права адміністратора змінено).",
  stale_auth_session:
    "Ваша сесія застаріла. Будь ласка, спробуйте увійти знову.",
  blocked: "Ваш акаунт було заблоковано адміністратором.",
};

function getErrorToastDurationMs(error: string): number {
  return error === "stale_auth_session" ? 5000 : 3000;
}

type Props = {
  error?: string;
};

export function HomeErrorToast({ error }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(
    error && ERROR_MESSAGES[error] ? error : null,
  );
  const message = activeError ? ERROR_MESSAGES[activeError] : undefined;
  const [visible, setVisible] = useState(() => Boolean(activeError));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!error || !ERROR_MESSAGES[error]) {
      return;
    }

    setActiveError(error);
    setVisible(true);
  }, [error]);

  useEffect(() => {
    if (!activeError || !ERROR_MESSAGES[activeError]) {
      return;
    }

    router.replace(pathname, { scroll: false });

    if (activeError === "blocked") {
      const supabase = createClient();
      void (async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          dispatchNavbarSync();
        }
      })();
    }

    const durationMs = getErrorToastDurationMs(activeError);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setActiveError(null);
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeError, pathname, router]);

  if (!mounted || typeof document === "undefined" || !visible || !message) {
    return null;
  }

  return createPortal(
    <div
      role="alert"
      className="pointer-events-auto fixed right-4 top-24 z-[100] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-2xl border border-red-100 bg-white/95 p-4 text-left shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)] ring-1 ring-red-50 backdrop-blur sm:right-6"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold leading-6 text-slate-800">{message}</p>
      <button
        type="button"
        aria-label="Закрити повідомлення"
        onClick={() => {
          setVisible(false);
          setActiveError(null);
        }}
        className="-mr-1 -mt-1 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  );
}
