import type { ProfileMessage } from "@/app/actions/profile";

export function ActionMessage({ state }: { state: ProfileMessage | undefined }) {
  if (!state?.message) {
    return null;
  }

  return (
    <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-600"} role="alert">
      {state.message}
    </p>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-[10px] font-bold uppercase text-red-500">{message}</p>;
}
