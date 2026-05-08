"use client";

import type { ReactNode } from "react";

import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import { Button } from "@/components/ui/button";

export type { ListingCardModel } from "@/lib/listings/listing-card-types";

const TYPE_SUBLINE: Record<ListingCardModel["type"], string> = {
  offering: "Шукаю когось до себе у квартиру",
  searching: "Шукаю, до кого можна заселитися",
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
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="aspect-[4/3] w-full bg-slate-100">
        {listing.firstImageUrl ? (
          <img src={listing.firstImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Фото відсутнє</div>
        )}
      </div>
      <div className="grid gap-3 p-4">
        <div className="grid gap-1">
          <h2 className="line-clamp-2 text-base font-bold text-slate-900">{listing.title}</h2>
          <p className="text-sm text-slate-600">{TYPE_SUBLINE[listing.type]}</p>
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
        <div className="flex items-center justify-between gap-2">
          <Button type="button" className={trailingActions ? "h-9 px-4" : "h-9 flex-1 px-4"} onClick={onView}>
            Оглянути
          </Button>
          {trailingActions}
        </div>
      </div>
    </article>
  );
}
