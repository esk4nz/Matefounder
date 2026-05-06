"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useMemo, useState, type FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { createListingAction } from "@/app/actions/listings";
import {
  LISTING_EXCLUSIVE_CATEGORIES,
  createListingFormSchema,
  type ListingFormValues,
} from "@/app/schemas/listings";
import { getListingTagDisplayLabel } from "@/lib/listings/listing-tag-display-labels";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";
import { FieldError } from "@/components/features/profile/profile-form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type RegionOption = { id: string; name: string };
type CityOption = { id: string; name: string; region_id: string };

type Props = {
  regions: RegionOption[];
  cities: CityOption[];
  tags: ProfileTagRow[];
};

const LISTING_TYPE_OPTIONS = [
  { value: "offering", label: "Я шукаю когось до себе у квартиру" },
  { value: "searching", label: "Я шукаю, до кого можна заселитися" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  habits: "Звички",
  routine: "Режим дня",
  social: "Гості та спілкування",
  pets: "Тварини",
};

export function CreateListingForm({ regions, cities, tags }: Props) {
  const [state, formAction, isPending] = useActionState(createListingAction, undefined);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedFilesCount, setSelectedFilesCount] = useState(0);

  const listingSchema = useMemo(() => createListingFormSchema(tags), [tags]);
  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      type: "offering",
      title: "",
      cityId: "",
      description: "",
      address: "",
      price: 0,
      availableFrom: "",
      availableUntil: "",
      tagSelections: {
        habits: null,
        routine: null,
        social: null,
        pets: null,
      },
    },
  });
  const selectedType = form.watch("type");

  const groupedTags = useMemo(() => {
    const map = new Map<string, ProfileTagRow[]>();
    for (const tag of tags) {
      const list = map.get(tag.category) ?? [];
      list.push(tag);
      map.set(tag.category, list);
    }
    return map;
  }, [tags]);

  const citiesForRegion = useMemo(
    () => cities.filter((city) => city.region_id === selectedRegionId),
    [cities, selectedRegionId],
  );

  const serverError = state && state.ok === false ? state.message : null;

  const onSubmit = (values: ListingFormValues) => {
    const selectedTagIds = Object.values(values.tagSelections ?? {}).filter(
      (id): id is number => typeof id === "number",
    );
    const fd = new FormData();
    fd.set("type", values.type);
    fd.set("title", values.title ?? "");
    fd.set("cityId", values.cityId);
    fd.set("description", values.description ?? "");
    fd.set("address", values.address ?? "");
    fd.set("price", String(values.price));
    fd.set("availableFrom", values.availableFrom);
    fd.set("availableUntil", values.availableUntil ?? "");
    fd.set("requiredTagIds", JSON.stringify(selectedTagIds));

    const imagesInput = document.getElementById("images") as HTMLInputElement | null;
    const files = imagesInput?.files ? Array.from(imagesInput.files) : [];
    for (const file of files) {
      fd.append("images", file);
    }

    startTransition(() => {
      formAction(fd);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.handleSubmit(onSubmit)(event);
  };

  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardHeader>
        <CardTitle className="text-2xl font-black text-slate-900">Створення анкети</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-6" noValidate onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label className={form.formState.errors.type ? "text-red-500" : "text-slate-700"}>
              Мета анкети
            </Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {LISTING_TYPE_OPTIONS.map((option) => {
                    const selected = field.value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => field.onChange(option.value)}
                        className={cn(
                          "rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors",
                          selected
                            ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                            : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            <FieldError message={form.formState.errors.type?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title" className={form.formState.errors.title ? "text-red-500" : "text-slate-700"}>
              Назва анкети
            </Label>
            <Input
              {...form.register("title")}
              id="title"
              className={cn("h-11", form.formState.errors.title ? "border-red-500 focus-visible:ring-red-500" : "")}
              maxLength={120}
            />
            <FieldError message={form.formState.errors.title?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="region" className="text-slate-700">
                Область
              </Label>
              <Select
                id="region"
                className="h-11"
                value={selectedRegionId}
                onChange={(event) => {
                  setSelectedRegionId(event.target.value);
                  form.setValue("cityId", "", { shouldValidate: false });
                  form.clearErrors("cityId");
                }}
              >
                <option value="">Оберіть область</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cityId" className={form.formState.errors.cityId ? "text-red-500" : "text-slate-700"}>
                Місто
              </Label>
              <Select
                {...form.register("cityId")}
                id="cityId"
                className={cn("h-11", form.formState.errors.cityId ? "border-red-500 focus-visible:ring-red-500" : "")}
                disabled={!selectedRegionId}
              >
                <option value="">{selectedRegionId ? "Оберіть місто" : "Спочатку оберіть область"}</option>
                {citiesForRegion.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </Select>
              <FieldError message={form.formState.errors.cityId?.message} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="description"
              className={form.formState.errors.description ? "text-red-500" : "text-slate-700"}
            >
              Опис анкети
            </Label>
            <Textarea
              {...form.register("description")}
              id="description"
              className={cn(
                "min-h-40 resize-y",
                form.formState.errors.description ? "border-red-500 focus-visible:ring-red-500" : "",
              )}
              placeholder="Опишіть житло або ваш запит до майбутнього співмешканця."
            />
            <p className="text-xs text-slate-500">Максимум 2000 символів.</p>
            <FieldError message={form.formState.errors.description?.message} />
          </div>

          {selectedType === "offering" ? (
            <div className="grid gap-2">
              <Label htmlFor="address" className={form.formState.errors.address ? "text-red-500" : "text-slate-700"}>
                Орієнтовна адреса житла (опційно)
              </Label>
              <Input
                {...form.register("address")}
                id="address"
                className={cn(
                  "h-11",
                  form.formState.errors.address ? "border-red-500 focus-visible:ring-red-500" : "",
                )}
                placeholder="Наприклад: Шевченківський район, біля метро Лук'янівська"
                maxLength={220}
              />
              <p className="text-xs text-slate-500">
                Будь ласка, не вказуйте точну адресу, достатньо вказати район або місцевість. Деталі адреси не публікуйте у відкритому доступі.
              </p>
              <FieldError message={form.formState.errors.address?.message} />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="price" className={form.formState.errors.price ? "text-red-500" : "text-slate-700"}>
                {selectedType === "offering"
                  ? "Очікувана плата/бюджет від співмешканця (грн/міс)"
                  : "Бюджет, який ви можете платити (грн/міс)"}
              </Label>
              <Input
                {...form.register("price", { valueAsNumber: true })}
                id="price"
                type="number"
                min={0}
                step={1}
                className={cn("h-11", form.formState.errors.price ? "border-red-500 focus-visible:ring-red-500" : "")}
              />
              <FieldError message={form.formState.errors.price?.message} />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="availableFrom"
                className={form.formState.errors.availableFrom ? "text-red-500" : "text-slate-700"}
              >
                Доступно з
              </Label>
              <Input
                {...form.register("availableFrom")}
                id="availableFrom"
                type="date"
                className={cn(
                  "h-11",
                  form.formState.errors.availableFrom ? "border-red-500 focus-visible:ring-red-500" : "",
                )}
              />
              <FieldError message={form.formState.errors.availableFrom?.message} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="availableUntil"
              className={form.formState.errors.availableUntil ? "text-red-500" : "text-slate-700"}
            >
              Доступно до (опційно)
            </Label>
            <Input
              {...form.register("availableUntil")}
              id="availableUntil"
              type="date"
              className={cn(
                "h-11",
                form.formState.errors.availableUntil ? "border-red-500 focus-visible:ring-red-500" : "",
              )}
            />
            <FieldError message={form.formState.errors.availableUntil?.message} />
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="grid gap-1">
              <Label htmlFor="images" className="text-slate-700">
                Фото анкети
              </Label>
              <p className="text-xs text-slate-500">Додайте мінімум 1 і максимум 10 фото (JPG, PNG, WEBP).</p>
            </div>
            <Input
              id="images"
              name="images"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              multiple
              required
              onChange={(event) => {
                setSelectedFilesCount(event.target.files?.length ?? 0);
              }}
            />
            <p className="text-xs text-slate-500">
              {selectedFilesCount > 0 ? `Обрано фото: ${selectedFilesCount}` : "Фото ще не обрані"}
            </p>
          </div>

          <div className="grid gap-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="grid gap-1">
              <p className="text-sm font-semibold text-slate-800">Теги очікуваного співмешканця</p>
              <p className="text-xs text-slate-500">Для кожної секції оберіть один обов&apos;язковий тег.</p>
            </div>

            {LISTING_EXCLUSIVE_CATEGORIES.map((category) => {
              const categoryTags = groupedTags.get(category) ?? [];
              return (
                <div key={category} className="grid gap-2">
                  <Label
                    className={
                      form.formState.errors.tagSelections?.[category] ? "text-red-500" : "text-slate-700"
                    }
                  >
                    {CATEGORY_LABELS[category] ?? category}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {categoryTags.map((tag) => {
                      const selected = form.watch(`tagSelections.${category}`) === tag.id;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => form.setValue(`tagSelections.${category}`, tag.id, { shouldValidate: true })}
                          className={cn(
                            "max-w-full cursor-pointer rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm font-semibold leading-snug transition-colors",
                            selected
                              ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
                          )}
                        >
                          {getListingTagDisplayLabel(tag.slug, tag.label_uk)}
                        </button>
                      );
                    })}
                  </div>
                  <FieldError message={form.formState.errors.tagSelections?.[category]?.message} />
                </div>
              );
            })}
          </div>

          {serverError ? (
            <p role="alert" className="text-sm text-red-600">
              {serverError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="submit" className="h-11 cursor-pointer px-6 font-bold" disabled={isPending}>
              {isPending ? "Створення..." : "Створити анкету"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
