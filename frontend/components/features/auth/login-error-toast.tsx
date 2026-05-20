"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type LoginError = {
  code?: string;
  message?: string;
};

type Props = {
  error?: LoginError | null;
};

const BLOCKED_BY_ADMIN_CODE = "blocked_by_admin";
const BLOCKED_BY_ADMIN_FALLBACK_MESSAGE =
  "Ваш акаунт заблокований адміністрацією.";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LoginErrorToast({ error }: Props) {
  const isHydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const urlError =
    isHydrated && typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("error")
      : undefined;
  const actionMessage =
    error?.code === BLOCKED_BY_ADMIN_CODE
      ? error.message ?? BLOCKED_BY_ADMIN_FALLBACK_MESSAGE
      : undefined;
  const urlMessage =
    urlError === BLOCKED_BY_ADMIN_CODE ? BLOCKED_BY_ADMIN_FALLBACK_MESSAGE : undefined;
  const message = actionMessage ?? urlMessage;
  const [dismissedError, setDismissedError] = useState<LoginError | null>(null);
  const [dismissedUrlError, setDismissedUrlError] = useState<string | null>(null);
  const visible = Boolean(
    actionMessage ? dismissedError !== error : urlMessage && dismissedUrlError !== urlError,
  );

  useEffect(() => {
    if (
      !message ||
      (actionMessage && dismissedError === error) ||
      (urlMessage && dismissedUrlError === urlError)
    ) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get("error") === BLOCKED_BY_ADMIN_CODE) {
      url.searchParams.delete("error");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

    const timer = window.setTimeout(() => {
      if (actionMessage) {
        setDismissedError(error ?? null);
      } else if (urlError) {
        setDismissedUrlError(urlError);
      }
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [
    actionMessage,
    dismissedError,
    dismissedUrlError,
    error,
    message,
    urlError,
    urlMessage,
  ]);

  if (!isHydrated || !visible || !message) {
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
          if (actionMessage) {
            setDismissedError(error ?? null);
          } else if (urlError) {
            setDismissedUrlError(urlError);
          }
        }}
        className="-mr-1 -mt-1 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  );
}
