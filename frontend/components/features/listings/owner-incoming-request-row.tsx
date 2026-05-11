"use client";

import Link from "next/link";
import { User as UserIcon } from "lucide-react";

import { OwnerSeekerRequestActions } from "@/components/features/listings/owner-seeker-request-actions";
import type { OwnerIncomingRequestItem } from "@/lib/listings/owner-incoming-request-types";

export type OwnerIncomingRequestRowProps = {
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

function seekerDisplayName(request: OwnerIncomingRequestItem) {
  const parts = [request.seekerFirstName, request.seekerLastName].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.join(" ");
}

function similarityPercentLabel(request: OwnerIncomingRequestItem) {
  const raw = request.similarityScore;
  if (raw != null && Number.isFinite(raw)) {
    return `${raw}%`;
  }
  return "null%";
}

export function OwnerIncomingRequestRow({
  listingId,
  listingUpdatedAt,
  request,
  tab,
  onAfterMutation,
  onOwnerActionIssue,
  onContactsReceived,
}: OwnerIncomingRequestRowProps) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2 align-middle">
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted">
          {request.seekerAvatarUrl ? (
            <img src={request.seekerAvatarUrl} alt="" className="size-9 object-cover" />
          ) : (
            <UserIcon className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </td>
      <td className="max-w-[220px] truncate px-3 py-2 align-middle font-medium text-foreground sm:max-w-[280px]">
        {seekerDisplayName(request)}
      </td>
      <td className="px-3 py-2 align-middle">
        <Link
          href={`/profile/${request.seekerId}/reviews`}
          className="font-medium text-primary underline underline-offset-2 hover:text-primary"
        >
          Відгуки
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-middle text-muted-foreground">
        {similarityPercentLabel(request)}
      </td>
      <td className="min-w-[280px] px-3 py-2 align-middle">
        <div className="flex flex-row flex-nowrap items-center justify-center gap-2">
          <OwnerSeekerRequestActions
            listingId={listingId}
            listingUpdatedAt={listingUpdatedAt}
            request={request}
            tab={tab}
            onAfterMutation={onAfterMutation}
            onOwnerActionIssue={onOwnerActionIssue}
            onContactsReceived={onContactsReceived}
          />
        </div>
      </td>
    </tr>
  );
}
