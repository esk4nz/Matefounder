import { z } from "zod";
import {
  PROFILE_ROLE_OPTIONS,
  getCitiesForRegion,
  isValidCityForRegion,
  isValidRegion,
} from "@/lib/profile/options";

const profileRoleValues = PROFILE_ROLE_OPTIONS.map((option) => option.value) as [
  (typeof PROFILE_ROLE_OPTIONS)[number]["value"],
  ...(typeof PROFILE_ROLE_OPTIONS)[number]["value"][],
];

const optionalLocationField = z
  .string()
  .optional()
  .transform((value) => value?.trim() ?? "");

export const profileSchema = z.object({
  firstName: z
    .string()
    .min(1, "Ім'я надто коротке")
    .regex(/^[a-zA-Zа-яА-ЯіІїЇєЄґҐ]+$/, {
      message: "Ім'я може містити лише букви",
    }),
  lastName: z
    .string()
    .min(1, "Прізвище надто коротке")
    .regex(/^[a-zA-Zа-яА-ЯіІїЇєЄґҐ]+$/, {
      message: "Прізвище може містити лише букви",
    }),
  username: z
    .string()
    .min(3, "Мінімум 3 символи")
    .max(20, "Максимум 20 символів")
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Тільки латиниця, цифри та '_'",
    }),
  role: z.enum(profileRoleValues),
  region: optionalLocationField,
  city: optionalLocationField,
  bio: z
    .string()
    .max(500, "Максимум 500 символів")
    .optional()
    .transform((value) => value?.trim() ?? ""),
}).superRefine((data, ctx) => {
  if (data.region && !isValidRegion(data.region)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Оберіть область зі списку",
      path: ["region"],
    });
  }

  if (data.city && !data.region) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Спочатку оберіть область",
      path: ["region"],
    });
  }

  if (data.city && data.region && !isValidCityForRegion(data.region, data.city)) {
    const availableCities = getCitiesForRegion(data.region);
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: availableCities.length ? "Оберіть місто зі списку" : "Для цієї області ще немає списку міст",
      path: ["city"],
    });
  }
});

export const profilePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введіть поточний пароль"),
    newPassword: z.string().min(8, "Пароль має бути не менше 8 символів"),
    confirmPassword: z.string().min(1, "Підтвердіть новий пароль"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Новий пароль має відрізнятися від поточного",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Паролі не співпадають",
    path: ["confirmPassword"],
  });

export const profileDeleteSchema = z.object({
  password: z.string().min(1, "Введіть пароль для підтвердження"),
});

export type ProfileValues = z.input<typeof profileSchema>;
export type NormalizedProfileValues = z.output<typeof profileSchema>;
export type ProfilePasswordValues = z.infer<typeof profilePasswordSchema>;
export type ProfileDeleteValues = z.infer<typeof profileDeleteSchema>;
