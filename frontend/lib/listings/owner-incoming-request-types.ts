import type { ListingRequestStatus } from "@/lib/listings/listing-details-types";

export type OwnerIncomingRequestItem = {
  requestId: string;
  seekerId: string;
  status: ListingRequestStatus;
  requestUpdatedAt: string;
  similarityScore: number | null;
  seekerFirstName: string;
  seekerLastName: string | null;
  seekerAvatarUrl: string | null;
  iBlockedSeeker: boolean;
};

export type GetIncomingRequestsActionResult =
  | { ok: false; reason: "unauthenticated" | "forbidden" | "unknown"; message?: string }
  | {
      ok: true;
      listingTitle: string;
      listingUpdatedAt: string;
      requests: OwnerIncomingRequestItem[];
    };
