import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateListingCta } from "@/components/features/listings/create-listing-cta";

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: listingsRows } = await supabase
    .from("listings")
    .select("id, title, type, is_active, listing_images(image_path, order_index)")
    .eq("creator_id", user.id)
    .order("updated_at", { ascending: false });

  const listings = (listingsRows ?? []).map((row) => {
    const firstImagePath = (row.listing_images ?? [])
      .slice()
      .sort((a, b) => a.order_index - b.order_index)[0]?.image_path;
    const firstImageUrl = firstImagePath
      ? supabase.storage.from("listing-images").getPublicUrl(firstImagePath).data.publicUrl
      : null;
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      isActive: row.is_active,
      firstImageUrl,
    };
  });

  return (
    <section className="container mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-black text-slate-900">Мої оголошення</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Керуйте своїми оголошеннями та відстежуйте відповіді від інших користувачів.
      </p>

      <CreateListingCta />

      {listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-blue-100 bg-white/80 px-6 py-14 text-center shadow-sm">
          <p className="text-base font-medium text-slate-600">У вас поки немає активних оголошень.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="aspect-[4/3] w-full bg-slate-100">
                {listing.firstImageUrl ? (
                  <img src={listing.firstImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Фото відсутнє
                  </div>
                )}
              </div>
              <div className="grid gap-3 p-4">
                <div className="grid gap-1">
                  <h2 className="line-clamp-2 text-base font-bold text-slate-900">{listing.title}</h2>
                  <p className="text-sm text-slate-600">
                    {listing.type === "offering"
                      ? "Шукаю когось до себе у квартиру"
                      : "Шукаю, до кого можна заселитися"}
                  </p>
                  {!listing.isActive ? <p className="text-xs font-semibold text-slate-500">Неактивне</p> : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Оглянути
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
                    aria-label="Меню дій"
                  >
                    ...
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
