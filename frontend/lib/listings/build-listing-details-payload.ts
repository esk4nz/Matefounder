import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PROFILE_EXCLUSIVE_CATEGORIES,
  PROFILE_INTERESTS_CATEGORY,
  type ProfileExclusiveTagCategory,
} from "@/app/schemas/profile";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";
import {
  mapTagsQueryToProfileRows,
  type TagsWithCategoryQueryRow,
} from "@/lib/profile/map-tags";
import type {
  ListingDetailsExclusiveByCategory,
  ListingDetailsPayload,
  ListingDetailsReviewSummary,
  ListingDetailsTag,
} from "@/lib/listings/listing-details-types";

type NestedTagRow = {
  id?: number;
  slug: string | null;
  label_uk: string | null;
  category_id?: number;
  tag_categories?: unknown;
};

export type ListingDetailsQueryRow = {
  id: string;
  title: string;
  type: string;
  description: string;
  price: number;
  address: string | null;
  available_from: string;
  available_until: string | null;
  creator_id: string;
  is_active?: boolean;
  listing_images: { image_path: string; order_index: number }[] | null;
  cities:
    | {
        name: string | null;
        regions: { name: string | null } | { name: string | null }[] | null;
      }
    | {
        name: string | null;
        regions: { name: string | null } | { name: string | null }[] | null;
      }[]
    | null;
  listing_required_tags: { tags: NestedTagRow | NestedTagRow[] | null }[] | null;
  profiles:
    | {
        first_name: string | null;
        last_name: string | null;
        profile_tags: { tags: NestedTagRow | NestedTagRow[] | null }[] | null;
      }
    | {
        first_name: string | null;
        last_name: string | null;
        profile_tags: { tags: NestedTagRow | NestedTagRow[] | null }[] | null;
      }[]
    | null;
};

function unwrapCityRow(
  cities: ListingDetailsQueryRow["cities"],
): {
  name: string | null;
  regions: { name: string | null } | { name: string | null }[] | null;
} | null {
  if (!cities) {
    return null;
  }
  return Array.isArray(cities) ? cities[0] ?? null : cities;
}

function regionNameFromCity(cities: ListingDetailsQueryRow["cities"]): string {
  const city = unwrapCityRow(cities);
  if (!city?.regions) {
    return "";
  }
  const r = city.regions;
  const row = Array.isArray(r) ? r[0] : r;
  return row?.name?.trim() ?? "";
}

function normalizeNestedTag(tag: NestedTagRow | NestedTagRow[] | null | undefined): NestedTagRow | null {
  if (!tag) {
    return null;
  }
  return Array.isArray(tag) ? tag[0] ?? null : tag;
}

function junctionToProfileTagRows(
  junction: { tags: NestedTagRow | NestedTagRow[] | null }[] | null | undefined,
): ProfileTagRow[] {
  const raw: TagsWithCategoryQueryRow[] = [];
  for (const row of junction ?? []) {
    const t = normalizeNestedTag(row.tags);
    if (
      t &&
      typeof t.id === "number" &&
      t.slug &&
      t.label_uk != null &&
      typeof t.category_id === "number"
    ) {
      raw.push({
        id: t.id,
        slug: t.slug,
        label_uk: t.label_uk,
        category_id: t.category_id,
        tag_categories: t.tag_categories,
      });
    }
  }
  return mapTagsQueryToProfileRows(raw);
}

function toExclusiveByCategory(tags: readonly ProfileTagRow[]): ListingDetailsExclusiveByCategory {
  const out: ListingDetailsExclusiveByCategory = {};
  for (const t of tags) {
    if (
      t.category === PROFILE_INTERESTS_CATEGORY ||
      !PROFILE_EXCLUSIVE_CATEGORIES.includes(t.category as ProfileExclusiveTagCategory)
    ) {
      continue;
    }
    const cat = t.category as ProfileExclusiveTagCategory;
    out[cat] = { slug: t.slug, labelUk: t.label_uk };
  }
  return out;
}

function toInterestTags(tags: readonly ProfileTagRow[]): ListingDetailsTag[] {
  const list = tags
    .filter((t) => t.category === PROFILE_INTERESTS_CATEGORY)
    .map((t) => ({ slug: t.slug, labelUk: t.label_uk }));
  list.sort((a, b) => a.labelUk.localeCompare(b.labelUk, "uk"));
  return list;
}

function unwrapCreatorProfile(
  profiles: ListingDetailsQueryRow["profiles"],
): {
  first_name: string | null;
  last_name: string | null;
  profile_tags: { tags: NestedTagRow | NestedTagRow[] | null }[] | null;
} | null {
  if (!profiles) {
    return null;
  }
  if (Array.isArray(profiles)) {
    return profiles[0] ?? null;
  }
  return profiles;
}

export function buildListingDetailsPayload(
  row: ListingDetailsQueryRow,
  opts: {
    supabase: SupabaseClient;
    reviewSummary: ListingDetailsReviewSummary | null;
  },
): ListingDetailsPayload {
  const bucket = opts.supabase.storage.from("listing-images");
  const images = (row.listing_images ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((im) => bucket.getPublicUrl(im.image_path).data.publicUrl);

  const cityRow = unwrapCityRow(row.cities);
  const city = cityRow?.name?.trim() ?? "";
  const region = regionNameFromCity(row.cities);
  const creator = unwrapCreatorProfile(row.profiles);
  const type = row.type === "searching" ? "searching" : "offering";

  const requiredProfileRows = junctionToProfileTagRows(row.listing_required_tags ?? []);
  const authorProfileRows = junctionToProfileTagRows(creator?.profile_tags ?? []);

  return {
    id: row.id,
    title: row.title,
    type,
    description: row.description,
    price: row.price,
    address: row.address?.trim() || null,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    creatorId: row.creator_id,
    creatorFirstName: creator?.first_name?.trim() ?? "",
    creatorLastName: creator?.last_name?.trim() ?? "",
    cityName: city,
    regionName: region,
    imageUrls: images,
    requiredByCategory: toExclusiveByCategory(requiredProfileRows),
    authorByCategory: toExclusiveByCategory(authorProfileRows),
    authorInterests: toInterestTags(authorProfileRows),
    reviewSummary: opts.reviewSummary,
  };
}
