"use client";

import { useActionState } from "react";
import { guardCreateListingAction } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";

export function CreateListingCta() {
  const [state, formAction, isPending] = useActionState(guardCreateListingAction, undefined);
  const errorMessage = state && state.ok === false ? state.message : null;

  return (
    <div className="mt-8">
      <form action={formAction} className="flex flex-col items-center gap-3">
        <Button type="submit" disabled={isPending} className="h-11 cursor-pointer px-6 font-bold">
          {isPending ? "Перевірка профілю..." : "Створити анкету"}
        </Button>
        {errorMessage ? (
          <p role="alert" className="max-w-2xl text-center text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}
