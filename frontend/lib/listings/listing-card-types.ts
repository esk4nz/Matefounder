import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";

export type ListingCardModel = {
  id: string;
  title: string;
  type: "offering" | "searching";
  isActive: boolean;
  updatedAt: string;
  firstImageUrl: string | null;
  similarityScore?: number | null;
  details: ListingDetailsPayload;
};
