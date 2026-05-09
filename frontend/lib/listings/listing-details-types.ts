import type { ProfileExclusiveTagCategory } from "@/app/schemas/profile";
import type { ListingGenderPreference } from "@/app/schemas/listings";

export type ListingDetailsReviewSummary = {
  averageOutOf10: number;
  count: number;
};

export type ListingDetailsTag = {
  slug: string;
  labelUk: string;
};

export type ListingDetailsExclusiveByCategory = Partial<
  Record<ProfileExclusiveTagCategory, ListingDetailsTag>
>;

export type ListingDetailsPayload = {
  id: string;
  title: string;
  type: "offering" | "searching";
  genderPreference: ListingGenderPreference;
  description: string;
  price: number;
  address: string | null;
  availableFrom: string;
  availableUntil: string | null;
  creatorId: string;
  creatorFirstName: string;
  creatorLastName: string;
  authorName: string;
  authorBio: string;
  creatorGender: "male" | "female" | null;
  cityName: string;
  regionName: string;
  imageUrls: string[];
  requiredByCategory: ListingDetailsExclusiveByCategory;
  authorByCategory: ListingDetailsExclusiveByCategory;
  authorInterests: ListingDetailsTag[];
  reviewSummary: ListingDetailsReviewSummary | null;
  similarityScore?: number | null;
};
