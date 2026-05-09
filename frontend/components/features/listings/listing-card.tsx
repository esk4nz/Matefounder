"use client";

import type { ReactNode } from "react";

import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import { Button } from "@/components/ui/button";

export type { ListingCardModel } from "@/lib/listings/listing-card-types";

const TYPE_SUBLINE: Record<ListingCardModel["type"], string> = {
  offering: "Шукаю сусіда",
  searching: "Шукаю житло",
};

type ListingCardProps = {
  listing: ListingCardModel;
  onView: () => void;
  showStatusBadge?: boolean;
  trailingActions?: ReactNode;
};

export function ListingCard({
  listing,
  onView,
  showStatusBadge = false,
  trailingActions,
}: ListingCardProps) {
  const locationLine = [listing.details.cityName, listing.details.regionName].filter(Boolean).join(", ");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full shrink-0 bg-slate-100">
        {listing.similarityScore != null ? (
          <div className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
            {listing.similarityScore}%
          </div>
        ) : null}
        {listing.firstImageUrl ? (
          <img src={listing.firstImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Фото відсутнє</div>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
          <span className="inline-flex w-fit rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {TYPE_SUBLINE[listing.type]}
          </span>
          <h2 className="line-clamp-2 text-base font-semibold text-slate-900">{listing.title}</h2>
          <p className="truncate text-sm text-slate-700" title={listing.details.authorName}>
            {listing.details.authorName}
          </p>
          <p className="truncate text-xs text-slate-500" title={locationLine}>
            {locationLine}
          </p>
          <p
            className="mt-1 text-base font-bold text-slate-900"
            title={`${listing.details.price.toLocaleString("uk-UA")} грн/міс`}
          >
            {listing.details.price.toLocaleString("uk-UA")} грн/міс
          </p>
          {showStatusBadge ? (
            <span
              className={
                listing.isActive
                  ? "inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                  : "inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
              }
            >
              {listing.isActive ? "Активне" : "Неактивне"}
            </span>
          ) : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <Button type="button" className={trailingActions ? "h-9 px-4" : "h-9 flex-1 px-4"} onClick={onView}>
            Оглянути
          </Button>
          {trailingActions}
        </div>
      </div>
    </article>
  );
}
