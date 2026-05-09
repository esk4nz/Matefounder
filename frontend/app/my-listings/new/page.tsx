import { redirect } from "next/navigation";
import { CreateListingForm } from "@/components/features/listings/create-listing-form";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { createClient } from "@/lib/supabase/server";

export default async function NewListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

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

  return (
    <section className="container mx-auto max-w-5xl px-6 py-12">
      <div className="mt-8">
        <CreateListingForm regions={regions} cities={cities} tags={tags} />
      </div>
    </section>
  );
}
