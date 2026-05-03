"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  profile_not_found:
    "Ой! Ваш профіль не знайдено. Будь ласка, зверніться в підтримку або спробуйте зайти знову",
  admin_required:
    "Доступ до консолі адміністрування для цього сеансу скасовано (права адміністратора змінено).",
};

type Props = {
  error?: string;
};

export function HomeErrorToast({ error }: Props) {
  const message = error ? ERROR_MESSAGES[error] : undefined;
  const [visible, setVisible] = useState(() => Boolean(message));

  useEffect(() => {
    if (!error || !ERROR_MESSAGES[error]) {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [error]);

  if (!visible || !message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed right-4 top-24 z-50 flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-2xl border border-red-100 bg-white/95 p-4 text-left shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)] ring-1 ring-red-50 backdrop-blur sm:right-6"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold leading-6 text-slate-800">{message}</p>
      <button
        type="button"
        aria-label="Закрити повідомлення"
        onClick={() => setVisible(false)}
        className="-mr-1 -mt-1 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
