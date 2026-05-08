import { z } from "zod";
import {
  PROFILE_EXCLUSIVE_CATEGORIES,
  type ProfileExclusiveTagCategory,
} from "@/app/schemas/profile";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";

const listingTypeValues = ["offering", "searching"] as const;

const SECTION_VALIDATION_LABELS: Record<string, string> = {
  habits: "звички",
  routine: "ритм дня",
  social: "гості та спілкування",
  pets: "ставлення до тварин",
};

export function createListingFormSchema(allTags: readonly ProfileTagRow[]) {
  const byId = new Map(allTags.map((tag) => [tag.id, tag]));
  const validIdsForCategory = (category: string) =>
    new Set(allTags.filter((tag) => tag.category === category).map((tag) => tag.id));

  const tagSelectionsSchema = z.object({
    habits: z.number().int().nullable(),
    routine: z.number().int().nullable(),
    social: z.number().int().nullable(),
    pets: z.number().int().nullable(),
  });

  return z
    .object({
      type: z.enum(listingTypeValues, {
        message: "Оберіть мету анкети.",
      }),
      title: z
        .string()
        .trim()
        .min(4, "Назва надто коротка — потрібно щонайменше 4 символи.")
        .max(120, "Назва занадто довга — максимум 120 символів."),
      cityId: z.string().uuid("Оберіть місто."),
      description: z
        .string()
        .trim()
        .min(20, "Опишіть анкету детальніше (мінімум 20 символів).")
        .max(2000, "Максимум 2000 символів."),
      address: z
        .string()
        .optional()
        .transform((value) => value?.trim() ?? "")
        .refine((value) => value.length <= 100, "Максимум 100 символів."),
      price: z
        .number({ message: "Вкажіть очікувану ціну." })
        .int("Ціна має бути цілим числом.")
        .min(0, "Ціна не може бути від'ємною.")
        .max(500000, "Ціна виглядає некоректно."),
      availableFrom: z.string().date("Оберіть дату, з якої доступне заселення."),
      availableUntil: z
        .string()
        .optional()
        .transform((value) => value?.trim() ?? "")
        .refine((value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value), {
          message: "Некоректна дата завершення.",
        }),
      tagSelections: tagSelectionsSchema,
    })
    .superRefine((data, ctx) => {
      for (const category of PROFILE_EXCLUSIVE_CATEGORIES) {
        const selectedId = data.tagSelections[category];
        if (selectedId === null || selectedId === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tagSelections", category],
            message: `Оберіть тег для секції "${SECTION_VALIDATION_LABELS[category]}".`,
          });
          continue;
        }
        const row = byId.get(selectedId);
        const allowed = validIdsForCategory(category);
        if (!row || row.category !== category || !allowed.has(selectedId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tagSelections", category],
            message: "Оберіть коректний тег для цієї секції.",
          });
        }
      }

      if (data.availableUntil.length > 0 && data.availableUntil < data.availableFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["availableUntil"],
          message: "Дата завершення не може бути раніше дати початку.",
        });
      }
    });
}

export type ListingFormSchema = ReturnType<typeof createListingFormSchema>;
export type ListingFormValues = z.input<ListingFormSchema>;

export const LISTING_EXCLUSIVE_CATEGORIES = PROFILE_EXCLUSIVE_CATEGORIES;
export type ListingExclusiveCategory = ProfileExclusiveTagCategory;

const optionalNonNegativeInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}, z.number().int().min(0).max(500000).optional());

const publicListingRequiredFiltersSchema = z
  .object({
    habits: z.number().int().optional(),
    routine: z.number().int().optional(),
    social: z.number().int().optional(),
    pets: z.number().int().optional(),
  })
  .optional();

export const publicListingsFiltersSchema = z
  .object({
    type: z.enum(["offering", "searching"]).optional(),
    cityId: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim() ?? "";
        return trimmed.length === 0 ? undefined : trimmed;
      })
      .pipe(z.string().uuid().optional()),
    cityIds: z.array(z.string().uuid()).max(600).optional(),
    priceMin: optionalNonNegativeInt,
    priceMax: optionalNonNegativeInt,
    requiredTags: publicListingRequiredFiltersSchema,
    authorInterestTagIds: z.array(z.number().int()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cityId && data.cityIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cityIds"],
        message: "Оберіть або одне місто, або область без конкретного міста.",
      });
    }
    if (
      data.priceMin !== undefined &&
      data.priceMax !== undefined &&
      data.priceMin > data.priceMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceMax"],
        message: "Верхня межа бюджету не може бути меншою за нижню.",
      });
    }
  });

export type PublicListingsFilters = z.infer<typeof publicListingsFiltersSchema>;
