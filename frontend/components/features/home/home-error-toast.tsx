"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

const PROFILE_NOT_FOUND_MESSAGE =
  "Ой! Ваш профіль не знайдено. Будь ласка, зверніться в підтримку або спробуйте зайти знову";

type Props = {
  error?: string;
};

export function HomeErrorToast({ error }: Props) {
  const [visible, setVisible] = useState(error === "profile_not_found");

  useEffect(() => {
    if (error !== "profile_not_found") {
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

  if (!visible) {
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
      <p className="text-sm font-semibold leading-6 text-slate-800">{PROFILE_NOT_FOUND_MESSAGE}</p>
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
