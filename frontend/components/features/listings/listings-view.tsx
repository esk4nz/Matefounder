"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  getPublicListingFreshDataAction,
  getPublicListingsAction,
} from "@/app/actions/listings";
import {
  PROFILE_EXCLUSIVE_CATEGORIES,
  PROFILE_INTERESTS_CATEGORY,
  type ProfileExclusiveTagCategory,
} from "@/app/schemas/profile";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";
import { ListingCard } from "@/components/features/listings/listing-card";
import { ListingDetailsModal } from "@/components/features/listings/listing-details-modal";
import { getListingTagDisplayLabel } from "@/lib/listings/listing-tag-display-labels";
import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RegionOption = { id: string; name: string };
type CityOption = { id: string; name: string; region_id: string };

const EXCLUSIVE_LABELS: Record<ProfileExclusiveTagCategory, string> = {
  habits: "Звички",
  routine: "Режим дня",
  social: "Гості та спілкування",
  pets: "Тварини",
};

const TYPE_FILTER_OPTIONS = [
  { value: "", label: "Усі типи" },
  { value: "offering", label: "Шукаю сусіда" },
  { value: "searching", label: "Шукаю житло" },
] as const;
const MAX_LISTING_PRICE = 500000;

type ListingsViewProps = {
  userId: string;
  initialListings: ListingCardModel[];
  initialTotal: number;
  regions: RegionOption[];
  cities: CityOption[];
  tags: ProfileTagRow[];
};

function parseBudgetInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return n;
}

function normalizeIntegerInput(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }
  const asNumber = Number.parseInt(digits, 10);
  if (!Number.isFinite(asNumber)) {
    return "";
  }
  return String(Math.min(asNumber, MAX_LISTING_PRICE));
}

function buildFiltersPayload(args: {
  typeFilter: "" | "offering" | "searching";
  cityId: string;
  regionCityIds: string[] | null;
  priceMin: string;
  priceMax: string;
  requiredTags: Partial<Record<ProfileExclusiveTagCategory, number | "">>;
  authorInterestIds: number[];
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (args.typeFilter === "offering" || args.typeFilter === "searching") {
    payload.type = args.typeFilter;
  }
  const trimmedCity = args.cityId.trim();
  if (trimmedCity) {
    payload.cityId = trimmedCity;
  } else if (args.regionCityIds && args.regionCityIds.length > 0) {
    payload.cityIds = args.regionCityIds;
  }
  const priceMin = parseBudgetInput(args.priceMin);
  const priceMax = parseBudgetInput(args.priceMax);
  if (priceMin !== undefined) {
    payload.priceMin = priceMin;
  }
  if (priceMax !== undefined) {
    payload.priceMax = priceMax;
  }
  const required: Partial<Record<ProfileExclusiveTagCategory, number>> = {};
  for (const cat of PROFILE_EXCLUSIVE_CATEGORIES) {
    const v = args.requiredTags[cat];
    if (typeof v === "number") {
      required[cat] = v;
    }
  }
  if (Object.keys(required).length > 0) {
    payload.requiredTags = required;
  }
  if (args.authorInterestIds.length > 0) {
    payload.authorInterestTagIds = args.authorInterestIds;
  }
  return payload;
}

export function ListingsView({
  userId,
  initialListings,
  initialTotal,
  regions,
  cities,
  tags,
}: ListingsViewProps) {
  const [listings, setListings] = useState(initialListings);
  const [total, setTotal] = useState(initialTotal);
  const [typeFilter, setTypeFilter] = useState<"" | "offering" | "searching">("");
  const [regionId, setRegionId] = useState("");
  const [cityId, setCityId] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [requiredTags, setRequiredTags] = useState<Partial<Record<ProfileExclusiveTagCategory, number | "">>>({});
  const [authorInterestIds, setAuthorInterestIds] = useState<number[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const [activeListingDetails, setActiveListingDetails] = useState<ListingDetailsPayload | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const activeListingTitle =
    openListingId ? (listings.find((listing) => listing.id === openListingId)?.title ?? null) : null;

  const interestTags = useMemo(
    () => tags.filter((t) => t.category === PROFILE_INTERESTS_CATEGORY).sort((a, b) => a.label_uk.localeCompare(b.label_uk, "uk")),
    [tags],
  );

  const tagsByCategory = useMemo(() => {
    const map = new Map<string, ProfileTagRow[]>();
    for (const tag of tags) {
      const list = map.get(tag.category) ?? [];
      list.push(tag);
      map.set(tag.category, list);
    }
    return map;
  }, [tags]);

  const citiesForRegion = useMemo(
    () => cities.filter((city) => city.region_id === regionId),
    [cities, regionId],
  );

  const applyFilters = useCallback(() => {
    startTransition(() => {
      void (async () => {
        setListError(null);
        const regionCityIds =
          regionId && !cityId.trim()
            ? cities.filter((city) => city.region_id === regionId).map((city) => city.id)
            : null;
        const payload = buildFiltersPayload({
          typeFilter,
          cityId,
          regionCityIds,
          priceMin,
          priceMax,
          requiredTags,
          authorInterestIds,
        });
        const result = await getPublicListingsAction(payload);
        if (!result.ok) {
          if (result.reason === "unauthenticated") {
            setListError("Сесія завершилася. Оновіть сторінку та увійдіть знову.");
            return;
          }
          setListError(result.message ?? "Не вдалося застосувати фільтри.");
          return;
        }
        setListings(result.listings);
        setTotal(result.total);
      })();
    });
  }, [authorInterestIds, cities, cityId, priceMax, priceMin, regionId, requiredTags, typeFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      applyFilters();
    }, 250);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [applyFilters]);

  useEffect(() => {
    if (!openListingId) {
      setActiveListingDetails(null);
      setIsDetailsLoading(false);
      return;
    }

    setActiveListingDetails(null);
    setIsDetailsLoading(true);

    let cancelled = false;
    const loadFreshDetails = async () => {
      try {
        const result = await getPublicListingFreshDataAction(openListingId);
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          if (result.reason === "notFound") {
            setListings((prev) => prev.filter((card) => card.id !== openListingId));
            setOpenListingId(null);
            setActiveListingDetails(null);
            setSyncWarning("Це оголошення більше недоступне. Список оновлено.");
          } else if (result.reason === "unauthenticated") {
            setOpenListingId(null);
            setActiveListingDetails(null);
            setSyncWarning("Сесія завершилася. Оновіть сторінку та увійдіть повторно.");
          } else {
            setSyncWarning("Не вдалося оновити дані оголошення. Спробуйте ще раз.");
          }
          return;
        }
        setSyncWarning(null);
        setActiveListingDetails(result.details);
        setListings((prev) => prev.map((card) => (card.id === result.card.id ? result.card : card)));
      } catch {
        if (!cancelled) {
          setSyncWarning("Не вдалося оновити дані оголошення. Спробуйте ще раз.");
        }
      } finally {
        if (!cancelled) {
          setIsDetailsLoading(false);
        }
      }
    };

    void loadFreshDetails();
    return () => {
      cancelled = true;
    };
  }, [openListingId]);

  const toggleAuthorInterest = (tagId: number) => {
    setAuthorInterestIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleBudgetMinChange = (nextRaw: string) => {
    const next = normalizeIntegerInput(nextRaw);
    const maxValue = parseBudgetInput(priceMax);
    const minValue = parseBudgetInput(next);
    if (
      typeof minValue === "number" &&
      typeof maxValue === "number" &&
      minValue > maxValue
    ) {
      setPriceMax(String(minValue));
    }
    setPriceMin(next);
  };

  const handleBudgetMaxChange = (nextRaw: string) => {
    const next = normalizeIntegerInput(nextRaw);
    const maxValue = parseBudgetInput(next);
    const minValue = parseBudgetInput(priceMin);
    if (
      typeof minValue === "number" &&
      typeof maxValue === "number" &&
      minValue > maxValue
    ) {
      setPriceMin(String(maxValue));
    }
    setPriceMax(next);
  };

  return (
    <section className="container mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-black text-slate-900">Оголошення</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Знайдіть співмешканця або житло за типом анкети, містом, бюджетом та очікуваннями щодо способу життя.
      </p>

      <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)] lg:w-80 lg:overflow-hidden lg:p-6">
          <div className="lg:flex lg:max-h-[calc(100vh-5rem)] lg:flex-col lg:gap-6">
            <div className="grid gap-2">
              <Label htmlFor="listing-type-filter" className="text-slate-700">
                Тип анкети
              </Label>
              <Select
                id="listing-type-filter"
                className="h-11"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as "" | "offering" | "searching");
                }}
              >
                {TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value === "" ? "all" : opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-semibold text-slate-900">Локація</p>
              <div className="grid gap-2">
                <Label htmlFor="listing-region" className="text-slate-700">
                  Область
                </Label>
                <Select
                  id="listing-region"
                  className="h-11"
                  value={regionId}
                  onChange={(event) => {
                    setRegionId(event.target.value);
                    setCityId("");
                  }}
                >
                  <option value="">Уся Україна</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="listing-city" className="text-slate-700">
                  Місто
                </Label>
                <Select
                  id="listing-city"
                  className="h-11"
                  value={cityId}
                  onChange={(event) => setCityId(event.target.value)}
                  disabled={!regionId}
                >
                  <option value="">{regionId ? "Усі міста області" : "Спочатку оберіть область"}</option>
                  {citiesForRegion.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-semibold text-slate-900">Бюджет (грн / міс.)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="price-min" className="text-slate-700">
                    Від
                  </Label>
                  <Input
                    id="price-min"
                    className="h-11"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={priceMin}
                    onChange={(e) => handleBudgetMinChange(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price-max" className="text-slate-700">
                    До
                  </Label>
                  <Input
                    id="price-max"
                    className="h-11"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={priceMax}
                    onChange={(e) => handleBudgetMaxChange(e.target.value)}
                    placeholder={String(MAX_LISTING_PRICE)}
                  />
                </div>
              </div>
              <div className="grid gap-2 pt-1">
                <input
                  type="range"
                  min={0}
                  max={MAX_LISTING_PRICE}
                  step={100}
                  value={parseBudgetInput(priceMin) ?? 0}
                  onChange={(e) => handleBudgetMinChange(e.target.value)}
                  className="w-full accent-blue-600"
                  aria-label="Мінімальна ціна"
                />
                <input
                  type="range"
                  min={0}
                  max={MAX_LISTING_PRICE}
                  step={100}
                  value={parseBudgetInput(priceMax) ?? MAX_LISTING_PRICE}
                  onChange={(e) => handleBudgetMaxChange(e.target.value)}
                  className="w-full accent-blue-600"
                  aria-label="Максимальна ціна"
                />
              </div>
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-semibold text-slate-900">Що ви очікуєте від вашого нового сусіда?</p>
              {PROFILE_EXCLUSIVE_CATEGORIES.map((category) => (
                <div key={category} className="grid gap-2">
                  <Label className="text-slate-700">{EXCLUSIVE_LABELS[category]}</Label>
                  <div className="flex flex-wrap gap-2">
                    {(tagsByCategory.get(category) ?? []).map((tag) => {
                      const selected = requiredTags[category] === tag.id;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setRequiredTags((prev) => ({
                              ...prev,
                              [category]: selected ? "" : tag.id,
                            }));
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            selected
                              ? "border-blue-300 bg-blue-50 text-blue-900"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                          )}
                        >
                          {getListingTagDisplayLabel(tag.slug, tag.label_uk)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid min-h-0 flex-1 gap-2">
              <Label className="text-slate-700">Інтереси автора</Label>
              <p className="text-xs text-slate-500">
                Показувати лише оголошення, де автор профілю позначив усі обрані інтереси.
              </p>
              <ScrollArea className="h-48 rounded-xl border border-slate-200 pr-3">
                <div className="grid gap-2 py-1">
                  {interestTags.map((tag) => {
                    const checked = authorInterestIds.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                          checked ? "border-blue-300 bg-blue-50 text-blue-950" : "border-transparent hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 rounded border-slate-300"
                          checked={checked}
                          onChange={() => toggleAuthorInterest(tag.id)}
                        />
                        <span>{getListingTagDisplayLabel(tag.slug, tag.label_uk)}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {isPending ? <p className="text-xs text-slate-500">Оновлення списку…</p> : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {syncWarning ? (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {syncWarning}
            </div>
          ) : null}
          {listError ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
              {listError}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-slate-600">
              Знайдено: <span className="font-semibold text-slate-900">{total}</span>
              {total > listings.length ? (
                <span className="text-slate-500"> (показано перші {listings.length})</span>
              ) : null}
            </p>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-base font-medium text-slate-600">За цими умовами оголошень не знайдено.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onView={() => setOpenListingId(listing.id)}
                  showStatusBadge={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ListingDetailsModal
        listing={activeListingDetails}
        fallbackTitle={activeListingTitle}
        loading={isDetailsLoading}
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
