import { redirect } from "next/navigation";

import type { MyListingCardModel } from "@/components/features/listings/my-listings-view";
import { MyListingsView } from "@/components/features/listings/my-listings-view";
import { buildListingDetailsPayload } from "@/lib/listings/build-listing-details-payload";
import type { ListingDetailsReviewSummary } from "@/lib/listings/listing-details-types";
import { extractListingIncomingRequestsCount } from "@/lib/listings/listing-requests-count";
import { PAGE_SHELL_CLASS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

const LISTING_DETAILS_SELECT = `
  id,
  title,
  type,
  gender_preference,
  description,
  price,
  address,
  available_from,
  available_until,
  creator_id,
  is_active,
  updated_at,
  listing_images(image_path, order_index),
  cities(name, regions(name)),
  listing_required_tags(tags(id, slug, label_uk, category_id, tag_categories(name))),
  profiles!listings_creator_id_fkey(
    first_name,
    last_name,
    gender,
    bio,
    profile_tags(tags(id, slug, label_uk, category_id, tag_categories(name)))
  ),
  listing_requests(count)
`;

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [{ data: listingsRows }, { data: reviewRatings }] = await Promise.all([
    supabase
      .from("listings")
      .select(LISTING_DETAILS_SELECT)
      .eq("creator_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("reviews").select("rating").eq("target_id", user.id),
  ]);

  let reviewSummary: ListingDetailsReviewSummary | null = null;
  const ratings = (reviewRatings ?? []).map((r) => r.rating).filter((n) => typeof n === "number");
  if (ratings.length > 0) {
    const avg5 = ratings.reduce((acc, n) => acc + n, 0) / ratings.length;
    reviewSummary = {
      averageOutOf10: avg5 * 2,
      count: ratings.length,
    };
  }

  const listings: MyListingCardModel[] = (listingsRows ?? []).map((row) => {
    const details = buildListingDetailsPayload(row, {
      supabase,
      reviewSummary,
    });
    const firstImageUrl = details.imageUrls[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      type: details.type,
      isActive: row.is_active,
      updatedAt: row.updated_at,
      requestUpdatedAt: null,
      firstImageUrl,
      similarityScore: null,
      requestStatus: null,
      isBlockedByMe: false,
      isBlockedByAuthor: false,
      incomingRequestsCount: extractListingIncomingRequestsCount(row),
      details,
    };
  });

  return (
    <section className={PAGE_SHELL_CLASS}>
      <MyListingsView userId={user.id} listings={listings} />
    </section>
  );
}
