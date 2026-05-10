"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";

import {
  blockListingAuthorAction,
  cancelListingRequestAction,
  createListingRequestAction,
  getAcceptedContactsAction,
  unblockListingAuthorAction,
  type SimpleListingMutationResult,
} from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import { resolveSeekerListingInteraction } from "@/lib/listings/seeker-listing-ui";
import { cn } from "@/lib/utils";

export type SeekerListingActionsProps = {
  listing: ListingCardModel;
  variant?: "card" | "modal";
  onAfterMutation: (listingId: string) => Promise<void>;
  onSeekerActionIssue?: (message: string) => void;
  onContactsReceived: (payload: {
    phone: string | null;
    telegram: string | null;
    email: string | null;
  }) => void;
};

function isFailedMutation(result: unknown): result is SimpleListingMutationResult & { ok: false } {
  return typeof result === "object" && result !== null && "ok" in result && (result as { ok: boolean }).ok === false;
}

export function SeekerListingActions({
  listing,
  variant = "card",
  onAfterMutation,
  onSeekerActionIssue,
  onContactsReceived,
}: SeekerListingActionsProps) {
  const [isPending, startTransition] = useTransition();
  const kind = resolveSeekerListingInteraction(listing);
  const busy = isPending;

  const wrap = (fn: () => Promise<SimpleListingMutationResult | void>) => {
    startTransition(() => {
      void (async () => {
        const result = await fn();
        if (isFailedMutation(result)) {
          onSeekerActionIssue?.(result.message ?? "Не вдалося виконати дію.");
          return;
        }
        await onAfterMutation(listing.id);
      })();
    });
  };

  const handleContacts = () => {
    startTransition(() => {
      void (async () => {
        const result = await getAcceptedContactsAction(listing.id, listing.requestUpdatedAt ?? "");
        if (result.ok) {
          onContactsReceived({
            phone: result.phone,
            telegram: result.telegram,
            email: result.email,
          });
          return;
        }
        const msg =
          result.reason === "unauthenticated"
            ? "Сесія завершилася. Оновіть сторінку та увійдіть повторно."
            : (result.message ?? "Не вдалося отримати контакти.");
        onSeekerActionIssue?.(msg);
      })();
    });
  };

  const primary = (() => {
    if (kind === "unblock") {
      return (
        <Button
          type="button"
          variant="secondary"
          className={cn("h-9 px-4", variant === "card" && "w-full")}
          disabled={busy}
          onClick={() =>
            wrap(() =>
              unblockListingAuthorAction(listing.id, listing.updatedAt, listing.requestUpdatedAt),
            )
          }
        >
          Розблокувати
        </Button>
      );
    }
    if (kind === "interested") {
      return (
        <Button
          type="button"
          className={cn("h-9 bg-blue-600 px-4 hover:bg-blue-700", variant === "card" && "w-full")}
          disabled={busy}
          onClick={() => wrap(() => createListingRequestAction(listing.id, listing.updatedAt))}
        >
          Цікаво
        </Button>
      );
    }
    if (kind === "cancel") {
      return (
        <Button
          type="button"
          variant="secondary"
          className={cn("h-9 px-4", variant === "card" && "w-full")}
          disabled={busy}
          onClick={() =>
            wrap(() => cancelListingRequestAction(listing.id, listing.requestUpdatedAt ?? ""))
          }
        >
          Скасувати заявку
        </Button>
      );
    }
    if (kind === "rejected") {
      return (
        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
          Відмовлено
        </span>
      );
    }
    if (kind === "contacts") {
      return (
        <Button
          type="button"
          className={cn("h-9 bg-blue-600 px-4 hover:bg-blue-700", variant === "card" && "w-full")}
          disabled={busy}
          onClick={handleContacts}
        >
          Контакти
        </Button>
      );
    }
    return null;
  })();

  const end =
    kind === "contacts" && !listing.isBlockedByMe ? (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={busy}
        aria-label="Заблокувати автора"
        onClick={() =>
          wrap(() =>
            blockListingAuthorAction(listing.id, listing.updatedAt, listing.requestUpdatedAt),
          )
        }
      >
        <Ban className="size-4" aria-hidden />
      </Button>
    ) : null;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        variant === "card" ? "flex-1" : "flex-wrap justify-end sm:flex-nowrap",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 justify-center",
          variant === "card" ? "flex-1" : "flex-none sm:flex-1 sm:justify-end",
        )}
      >
        {primary}
      </div>
      {end}
    </div>
  );
}
