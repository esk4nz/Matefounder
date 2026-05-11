import type { ListingCardModel } from "@/lib/listings/listing-card-types";

export type SeekerListingInteractionKind =
  | "interested"
  | "cancel"
  | "rejected"
  | "contacts"
  | "unblock";

export function resolveSeekerListingInteraction(listing: ListingCardModel): SeekerListingInteractionKind {
  if (listing.isBlockedByMe) {
    return "unblock";
  }
  if (listing.isBlockedByAuthor) {
    return "rejected";
  }
  if (listing.requestStatus === "pending") {
    return "cancel";
  }
  if (listing.requestStatus === "rejected") {
    return "rejected";
  }
  if (listing.requestStatus === "accepted") {
    return "contacts";
  }
  return "interested";
}
