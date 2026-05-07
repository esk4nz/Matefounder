"use client";

import Link from "next/link";
import { MapPinIcon } from "lucide-react";

import {
  PROFILE_EXCLUSIVE_CATEGORIES,
  type ProfileExclusiveTagCategory,
} from "@/app/schemas/profile";
import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";
import { getListingTagDisplayLabel } from "@/lib/listings/listing-tag-display-labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListingPhotoCarousel } from "@/components/features/listings/listing-photo-carousel";
import {
  isListingPhotoLightboxLayerOpen,
  isListingPhotoLightboxTarget,
} from "@/lib/listings/listing-photo-lightbox";

function formatUaLongDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function reviewsCountPhrase(count: number): string {
  const n100 = Math.abs(count) % 100;
  const n10 = Math.abs(count) % 10;
  let word: string;
  if (n100 >= 11 && n100 <= 14) {
    word = "відгуків";
  } else if (n10 === 1) {
    word = "відгук";
  } else if (n10 >= 2 && n10 <= 4) {
    word = "відгуки";
  } else {
    word = "відгуків";
  }
  return `${count} ${word}`;
}

const LISTING_TYPE_LABEL: Record<ListingDetailsPayload["type"], string> = {
  offering: "Шукаю сусіда",
  searching: "Шукаю житло",
};

const EXCLUSIVE_CATEGORY_LABEL_UK: Record<ProfileExclusiveTagCategory, string> = {
  habits: "Звички",
  routine: "Режим дня",
  social: "Гості та спілкування",
  pets: "Тварини",
};

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800">
      {label}
    </span>
  );
}

export type ListingDetailsModalProps = {
  listing: ListingDetailsPayload | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onInterested?: () => void;
};

export function ListingDetailsModal({
  listing,
  open,
  onOpenChange,
  currentUserId,
  onInterested,
}: ListingDetailsModalProps) {
  const showInterested = Boolean(listing && listing.creatorId !== currentUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,880px)] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 motion-reduce:transition-none sm:max-w-2xl lg:max-w-3xl"
        onPointerDownOutside={(e) => {
          if (isListingPhotoLightboxTarget(e.target)) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (isListingPhotoLightboxTarget(e.target)) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          if (isListingPhotoLightboxTarget(e.target)) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isListingPhotoLightboxLayerOpen()) {
            e.preventDefault();
          }
        }}
      >
        {listing ? (
          <>
            <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4">
              <DialogTitle className="text-left text-lg font-bold leading-snug text-slate-900">
                {listing.title}
              </DialogTitle>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable]">
              <div className="space-y-5 px-5 py-4">
                <ListingPhotoCarousel imageUrls={listing.imageUrls} />

                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {listing.creatorFirstName} {listing.creatorLastName}
                  </p>
                  <div className="text-sm">
                    <Link
                      href={`/profile/${listing.creatorId}/reviews`}
                      className="font-medium text-blue-700 underline-offset-2 hover:underline"
                    >
                      {listing.reviewSummary && listing.reviewSummary.count > 0
                        ? `⭐ ${listing.reviewSummary.averageOutOf10.toFixed(1)}/10 (${reviewsCountPhrase(
                            listing.reviewSummary.count,
                          )})`
                        : "ще немає відгуків"}
                    </Link>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Тип</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {LISTING_TYPE_LABEL[listing.type]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      {listing.type === "searching" ? "Бюджет" : "Ціна"}
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {listing.price.toLocaleString("uk-UA")} ₴
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-slate-500">Локація</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {listing.cityName}, {listing.regionName}
                    </dd>
                    {listing.address ? (
                      <dd className="mt-1.5 flex gap-1.5 text-slate-700">
                        <MapPinIcon
                          className="mt-0.5 size-4 shrink-0 text-slate-500"
                          aria-hidden
                        />
                        <span>{listing.address}</span>
                      </dd>
                    ) : null}
                  </div>
                  <div className="col-span-2 space-y-1">
                    <dt className="text-xs font-medium text-slate-500">Дати</dt>
                    <dd className="font-medium text-slate-900">
                      Дата заселення з: {formatUaLongDate(listing.availableFrom)}
                    </dd>
                    {listing.availableUntil ? (
                      <dd className="font-medium text-slate-900">
                        Дата виселення: {formatUaLongDate(listing.availableUntil)}
                      </dd>
                    ) : null}
                  </div>
                </dl>

                <div>
                  <h3 className="text-xs font-medium text-slate-500">Опис</h3>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {listing.description}
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900">Вимоги до сусіда</p>
                    <div className="space-y-3">
                      {PROFILE_EXCLUSIVE_CATEGORIES.map((cat) => {
                        const tag = listing.requiredByCategory[cat];
                        return (
                          <div key={cat}>
                            <p className="text-xs font-medium text-slate-500">
                              {EXCLUSIVE_CATEGORY_LABEL_UK[cat]}
                            </p>
                            <div className="mt-1">
                              {tag ? (
                                <TagChip
                                  label={getListingTagDisplayLabel(tag.slug, tag.labelUk)}
                                />
                              ) : (
                                <span className="text-sm text-slate-500">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900">Про автора</p>
                    <div className="space-y-3">
                      {PROFILE_EXCLUSIVE_CATEGORIES.map((cat) => {
                        const tag = listing.authorByCategory[cat];
                        return (
                          <div key={cat}>
                            <p className="text-xs font-medium text-slate-500">
                              {EXCLUSIVE_CATEGORY_LABEL_UK[cat]}
                            </p>
                            <div className="mt-1">
                              {tag ? (
                                <TagChip
                                  label={getListingTagDisplayLabel(tag.slug, tag.labelUk)}
                                />
                              ) : (
                                <span className="text-sm text-slate-500">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pb-1">
                  <p className="text-sm font-semibold text-slate-900">Інтереси</p>
                  {listing.authorInterests.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {listing.authorInterests.map((tag) => (
                        <TagChip
                          key={tag.slug}
                          label={getListingTagDisplayLabel(tag.slug, tag.labelUk)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">Не вказано.</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 rounded-none border-t bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Закрити
                </Button>
              </DialogClose>
              {showInterested ? (
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    onInterested?.();
                  }}
                >
                  Зацікавлений
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
