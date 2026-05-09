import { redirect } from "next/navigation";

import { getPublicListingsAction } from "@/app/actions/listings";
import { ListingsView } from "@/components/features/listings/listings-view";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { createClient } from "@/lib/supabase/server";

export default async function ListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingsResult = await getPublicListingsAction({});

  const [regionsResult, citiesResult, tagsResult] = await Promise.all([
    supabase.from("regions").select("id, name").order("name", { ascending: true }),
    supabase.from("cities").select("id, name, region_id").order("name", { ascending: true }),
    supabase
      .from("tags")
      .select(TAGS_WITH_CATEGORY_SELECT)
      .order("category_id", { ascending: true })
      .order("slug", { ascending: true }),
  ]);

  const regions = regionsResult.data ?? [];
  const cities = citiesResult.data ?? [];
  const tags = mapTagsQueryToProfileRows(tagsResult.data ?? []);

  if (!listingsResult.ok) {
    if (listingsResult.reason === "unauthenticated") {
      redirect("/login");
    }
  }

  const initialListings = listingsResult.ok ? listingsResult.listings : [];
  const initialTotal = listingsResult.ok ? listingsResult.total : 0;

  return (
    <ListingsView
      userId={user.id}
      initialListings={initialListings}
      initialTotal={initialTotal}
      regions={regions}
      cities={cities}
      tags={tags}
    />
  );
}
