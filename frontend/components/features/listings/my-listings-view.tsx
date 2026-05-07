"use client";

import { useState } from "react";

import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";
import { CreateListingCta } from "@/components/features/listings/create-listing-cta";
import { ListingDetailsModal } from "@/components/features/listings/listing-details-modal";

export type MyListingCardModel = {
  id: string;
  title: string;
  type: "offering" | "searching";
  isActive: boolean;
  firstImageUrl: string | null;
  details: ListingDetailsPayload;
};

type MyListingsViewProps = {
  userId: string;
  listings: MyListingCardModel[];
};

const TYPE_SUBLINE: Record<MyListingCardModel["type"], string> = {
  offering: "Шукаю когось до себе у квартиру",
  searching: "Шукаю, до кого можна заселитися",
};

export function MyListingsView({ userId, listings }: MyListingsViewProps) {
  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const activeListing = openListingId
    ? (listings.find((l) => l.id === openListingId) ?? null)
    : null;

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
                  <img
                    src={listing.firstImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Фото відсутнє
                  </div>
                )}
              </div>
              <div className="grid gap-3 p-4">
                <div className="grid gap-1">
                  <h2 className="line-clamp-2 text-base font-bold text-slate-900">{listing.title}</h2>
                  <p className="text-sm text-slate-600">{TYPE_SUBLINE[listing.type]}</p>
                  {!listing.isActive ? (
                    <p className="text-xs font-semibold text-slate-500">Неактивне</p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    onClick={() => setOpenListingId(listing.id)}
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

      <ListingDetailsModal
        listing={activeListing?.details ?? null}
        open={openListingId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setOpenListingId(null);
          }
        }}
        currentUserId={userId}
      />
    </section>
  );
}
