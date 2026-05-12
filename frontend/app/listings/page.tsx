import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getPublicListingsAction } from "@/app/actions/listings";
import { ListingsView, type ListingsSeekerProfileGate } from "@/components/features/listings/listings-view";
import { PAGE_SHELL_CLASS } from "@/lib/utils";
import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import { collectMissingSeekerProfileFields } from "@/lib/profile/profile-completeness";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { createClient } from "@/lib/supabase/server";

type ListingsPageProps = {
  searchParams?: Promise<{ page?: string }>;
};

function parseListingsPage(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    return 1;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return n;
}

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const params = (await searchParams) ?? {};
  const initialPage = parseListingsPage(params.page);
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
    const listingsResult = await getPublicListingsAction({ page: initialPage });
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
    <section className={PAGE_SHELL_CLASS}>
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <ListingsView
          userId={user.id}
          seekerGate={seekerGate}
          initialListings={initialListings}
          initialTotal={initialTotal}
          initialPage={initialPage}
          regions={regions}
          cities={cities}
          tags={tags}
        />
      </Suspense>
    </section>
  );
}
