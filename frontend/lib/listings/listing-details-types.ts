import type { ProfileExclusiveTagCategory } from "@/app/schemas/profile";

export type ListingDetailsReviewSummary = {
  averageOutOf10: number;
  count: number;
};

export type ListingDetailsTag = {
  slug: string;
  labelUk: string;
};

/** По одному тегу на кожну з чотирьох ексклюзивних категорій (якщо є). */
export type ListingDetailsExclusiveByCategory = Partial<
  Record<ProfileExclusiveTagCategory, ListingDetailsTag>
>;

export type ListingDetailsPayload = {
  id: string;
  title: string;
  type: "offering" | "searching";
  description: string;
  price: number;
  address: string | null;
  availableFrom: string;
  availableUntil: string | null;
  creatorId: string;
  creatorFirstName: string;
  creatorLastName: string;
  cityName: string;
  regionName: string;
  imageUrls: string[];
  requiredByCategory: ListingDetailsExclusiveByCategory;
  authorByCategory: ListingDetailsExclusiveByCategory;
  authorInterests: ListingDetailsTag[];
  /** Null when viewer cannot read authoritative review aggregates (or none exist). */
  reviewSummary: ListingDetailsReviewSummary | null;
};
