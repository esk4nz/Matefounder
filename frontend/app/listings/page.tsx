import { redirect } from "next/navigation";

import { getPublicListingsAction } from "@/app/actions/listings";
import { ListingsView, type ListingsSeekerProfileGate } from "@/components/features/listings/listings-view";
import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import { collectMissingSeekerProfileFields } from "@/lib/profile/profile-completeness";
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

  const [profileRes, profileTagsRes, regionsResult, citiesResult, tagsResult] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name, contact_phone").eq("id", user.id).maybeSingle(),
    supabase.from("profile_tags").select("tag_id").eq("profile_id", user.id),
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

  let seekerGate: ListingsSeekerProfileGate;

  if (profileRes.error || !profileRes.data) {
    seekerGate = {
      mode: "error",
      message: "Не вдалося знайти профіль. Оновіть сторінку та спробуйте ще раз.",
    };
  } else if (profileTagsRes.error) {
    seekerGate = {
      mode: "error",
      message: "Не вдалося перевірити теги профілю. Спробуйте ще раз.",
    };
  } else if (tagsResult.error || tags.length === 0) {
    seekerGate = {
      mode: "error",
      message: "Не вдалося перевірити теги профілю. Спробуйте ще раз.",
    };
  } else {
    const missingFields = collectMissingSeekerProfileFields({
      profile: profileRes.data,
      selectedTagIds: (profileTagsRes.data ?? []).map((row) => row.tag_id),
      allTagRows: tags,
    });
    seekerGate =
      missingFields.length > 0 ? { mode: "blocked", missingFields } : { mode: "allowed" };
  }

  let initialListings: ListingCardModel[] = [];
  let initialTotal = 0;

  if (seekerGate.mode === "allowed") {
    const listingsResult = await getPublicListingsAction({});
    if (!listingsResult.ok) {
      if (listingsResult.reason === "unauthenticated") {
        redirect("/login");
      }
    } else {
      initialListings = listingsResult.listings;
      initialTotal = listingsResult.total;
    }
  }

  return (
    <ListingsView
      userId={user.id}
      seekerGate={seekerGate}
      initialListings={initialListings}
      initialTotal={initialTotal}
      regions={regions}
      cities={cities}
      tags={tags}
    />
  );
}
