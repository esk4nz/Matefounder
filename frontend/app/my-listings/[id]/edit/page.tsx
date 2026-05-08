import { redirect } from "next/navigation";
import { EditListingForm } from "@/components/features/listings/edit-listing-form";
import { MyListingsFlashRedirect } from "@/components/features/listings/my-listings-flash-redirect";
import type { ListingFormValues } from "@/app/schemas/listings";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import type { ExistingListingPhotoItem } from "@/components/features/listings/listing-photos-picker";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditMyListingPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  const { id } = await params;
  const [regionsResult, citiesResult, tagsResult, listingResult, listingTagsResult, listingImagesResult] =
    await Promise.all([
      supabase.from("regions").select("id, name").order("name", { ascending: true }),
      supabase.from("cities").select("id, name, region_id").order("name", { ascending: true }),
      supabase
        .from("tags")
        .select(TAGS_WITH_CATEGORY_SELECT)
        .order("category_id", { ascending: true })
        .order("slug", { ascending: true }),
      supabase
        .from("listings")
        .select("id, updated_at, type, title, city_id, gender_preference, description, address, price, available_from, available_until")
        .eq("id", id)
        .eq("creator_id", user.id)
        .maybeSingle(),
      supabase
        .from("listing_required_tags")
        .select("tag_id")
        .eq("listing_id", id),
      supabase
        .from("listing_images")
        .select("image_path, order_index")
        .eq("listing_id", id)
        .order("order_index", { ascending: true }),
    ]);

  if (!listingResult.data) {
    return <MyListingsFlashRedirect />;
  }

  const regions = regionsResult.data ?? [];
  const cities = citiesResult.data ?? [];
  const tags = mapTagsQueryToProfileRows(tagsResult.data ?? []);
  const selectedTagIds = new Set((listingTagsResult.data ?? []).map((row) => row.tag_id));
  const selectedByCategory: ListingFormValues["tagSelections"] = {
    habits: null,
    routine: null,
    social: null,
    pets: null,
  };
  for (const row of tags) {
    if (!selectedTagIds.has(row.id)) {
      continue;
    }
    if (row.category in selectedByCategory && !selectedByCategory[row.category as keyof typeof selectedByCategory]) {
      selectedByCategory[row.category as keyof typeof selectedByCategory] = row.id;
    }
  }

  const imageItems: ExistingListingPhotoItem[] = (listingImagesResult.data ?? [])
    .map((row) => row.image_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0)
    .map((imagePath) => ({
      id: imagePath,
      kind: "existing" as const,
      imagePath,
      previewUrl: supabase.storage.from("listing-images").getPublicUrl(imagePath).data.publicUrl,
    }));

  const listing = listingResult.data;
  const initialValues: ListingFormValues = {
    type: listing.type === "searching" ? "searching" : "offering",
    title: listing.title ?? "",
    cityId: listing.city_id ?? "",
    genderPreference: listing.gender_preference === "male" || listing.gender_preference === "female" ? listing.gender_preference : "any",
    description: listing.description ?? "",
    address: listing.address ?? "",
    price: typeof listing.price === "number" ? listing.price : 0,
    availableFrom: listing.available_from ?? "",
    availableUntil: listing.available_until ?? "",
    tagSelections: selectedByCategory,
  };

  return (
    <section className="container mx-auto max-w-5xl px-6 py-12">
      <div className="mt-8">
        <EditListingForm
          regions={regions}
          cities={cities}
          tags={tags}
          initialListing={{
            id: listing.id,
            updatedAt: listing.updated_at,
            values: initialValues,
            imageItems,
          }}
        />
      </div>
    </section>
  );
}
