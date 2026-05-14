"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";

import {
  blockListingSeekerAction,
  getOwnerSeekerContactsAction,
  ownerRespondToListingRequestAction,
  unblockListingSeekerAction,
  type SimpleListingMutationResult,
} from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import type { OwnerIncomingRequestItem } from "@/lib/listings/owner-incoming-request-types";

export type OwnerSeekerRequestActionsProps = {
  listingId: string;
  listingUpdatedAt: string;
  request: OwnerIncomingRequestItem;
  tab: "accepted" | "pending" | "rejected" | "blocked";
  onAfterMutation: () => Promise<void>;
  onOwnerActionIssue?: (message: string) => void;
  onContactsReceived: (payload: {
    phone: string | null;
    telegram: string | null;
    email: string | null;
  }) => void;
};

function isFailedMutation(result: unknown): result is SimpleListingMutationResult & { ok: false } {
  return typeof result === "object" && result !== null && "ok" in result && (result as { ok: boolean }).ok === false;
}

const blockSeekerButtonClassName =
  "border-destructive/80 text-destructive hover:bg-destructive/10 hover:text-destructive";

export function OwnerSeekerRequestActions({
  listingId,
  listingUpdatedAt,
  request,
  tab,
  onAfterMutation,
  onOwnerActionIssue,
  onContactsReceived,
}: OwnerSeekerRequestActionsProps) {
  const [isPending, startTransition] = useTransition();
  const busy = isPending;

  const wrap = (fn: () => Promise<SimpleListingMutationResult | void>) => {
    startTransition(() => {
      void (async () => {
        const result = await fn();
        if (isFailedMutation(result)) {
          onOwnerActionIssue?.(result.message ?? "Не вдалося виконати дію.");
          return;
        }
        await onAfterMutation();
      })();
    });
  };

  const handleContacts = () => {
    startTransition(() => {
      void (async () => {
        const result = await getOwnerSeekerContactsAction(
          listingId,
          request.seekerId,
          request.requestUpdatedAt,
        );
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
        onOwnerActionIssue?.(msg);
      })();
    });
  };

  const blockSeekerButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={blockSeekerButtonClassName}
      disabled={busy}
      aria-label="Заблокувати заявника"
      onClick={() =>
        wrap(() =>
          blockListingSeekerAction(
            listingId,
            request.seekerId,
            listingUpdatedAt,
            request.requestUpdatedAt,
          ),
        )
      }
    >
      <Ban className="size-3.5" aria-hidden />
    </Button>
  );

  if (tab === "blocked") {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-w-[7.5rem]"
        disabled={busy}
        onClick={() =>
          wrap(() =>
            unblockListingSeekerAction(
              listingId,
              request.seekerId,
              listingUpdatedAt,
              request.requestUpdatedAt,
            ),
          )
        }
      >
        Розблокувати
      </Button>
    );
  }

  if (tab === "accepted") {
    const hideContacts = request.status === "accepted" && request.seekerBlockedMe === true;
    return (
      <div className="flex max-w-[min(100vw-8rem,22rem)] flex-wrap items-center justify-end gap-1.5 sm:max-w-none">
        {!hideContacts ? (
          <Button type="button" size="sm" disabled={busy} onClick={handleContacts}>
            Контакти
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() =>
            wrap(() =>
              ownerRespondToListingRequestAction(
                listingId,
                request.requestId,
                "rejected",
                request.requestUpdatedAt,
              ),
            )
          }
        >
          Відхилити
        </Button>
        {blockSeekerButton}
      </div>
    );
  }

  if (tab === "pending") {
    return (
      <div className="flex max-w-[min(100vw-8rem,22rem)] flex-wrap items-center justify-end gap-1.5 sm:max-w-none">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() =>
            wrap(() =>
              ownerRespondToListingRequestAction(
                listingId,
                request.requestId,
                "accepted",
                request.requestUpdatedAt,
              ),
            )
          }
        >
          Схвалити
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() =>
            wrap(() =>
              ownerRespondToListingRequestAction(
                listingId,
                request.requestId,
                "rejected",
                request.requestUpdatedAt,
              ),
            )
          }
        >
          Відхилити
        </Button>
        {blockSeekerButton}
      </div>
    );
  }

  if (tab === "rejected") {
    return (
      <div className="flex max-w-[min(100vw-8rem,22rem)] flex-wrap items-center justify-end gap-1.5 sm:max-w-none">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() =>
            wrap(() =>
              ownerRespondToListingRequestAction(
                listingId,
                request.requestId,
                "pending",
                request.requestUpdatedAt,
              ),
            )
          }
        >
          Відмінити
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={blockSeekerButtonClassName}
          disabled={busy}
          aria-label="Заблокувати заявника"
          onClick={() =>
            wrap(() =>
              blockListingSeekerAction(
                listingId,
                request.seekerId,
                listingUpdatedAt,
                request.requestUpdatedAt,
              ),
            )
          }
        >
          <Ban className="size-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  return null;
}
