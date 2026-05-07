import { redirect } from "next/navigation";

import type { MyListingCardModel } from "@/components/features/listings/my-listings-view";
import { MyListingsView } from "@/components/features/listings/my-listings-view";
import { buildListingDetailsPayload } from "@/lib/listings/build-listing-details-payload";
import { LISTING_DETAILS_SELECT } from "@/lib/listings/listing-details-select";
import type { ListingDetailsReviewSummary } from "@/lib/listings/listing-details-types";
import { createClient } from "@/lib/supabase/server";

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
      firstImageUrl,
      details,
    };
  });

  return <MyListingsView userId={user.id} listings={listings} />;
}
