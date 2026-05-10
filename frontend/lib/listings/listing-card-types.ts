import type { ListingDetailsPayload, ListingRequestStatus } from "@/lib/listings/listing-details-types";

export type { ListingRequestStatus };

export type ListingCardModel = {
  id: string;
  title: string;
  type: "offering" | "searching";
  isActive: boolean;
  updatedAt: string;
  requestUpdatedAt: string | null;
  firstImageUrl: string | null;
  similarityScore: number | null;
  requestStatus: ListingRequestStatus | null;
  isBlockedByMe: boolean;
  isBlockedByAuthor: boolean;
  details: ListingDetailsPayload;
};
