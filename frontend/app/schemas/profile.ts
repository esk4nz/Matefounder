import { z } from "zod";
import type { ProfileTagRow, ProfileTagSelectionsExclusive } from "@/components/features/profile/profile-types";

export const PROFILE_TAG_CATALOG_CHANGED_MESSAGE =
  "Список доступних інтересів змінився. Будь ласка, оновіть сторінку, щоб побачити актуальний перелік.";
export const NEW_PASSWORD_REQUIREMENTS_HINT =
  "Мінімум 8 символів, велика і мала латинська літера та спецсимвол: ! @ # $ % & * ? - _ .";

export const PROFILE_EXCLUSIVE_CATEGORIES = ["habits", "routine", "social", "pets"] as const;
export type ProfileExclusiveTagCategory = (typeof PROFILE_EXCLUSIVE_CATEGORIES)[number];
export const PROFILE_INTERESTS_CATEGORY = "interests" as const;

type ProfileGenderValue = "male" | "female";
const profileGenderInputValues = ["", "male", "female"] as const;
const ukrainianPhoneRegex = /^\+380\d{9}$/;
const personNamePartRegex = /^\p{L}+(?:['’\-]\p{L}+)*$/u;
const passwordAllowedCharactersRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;
const passwordSpecialCharacterRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const PERSON_NAME_ALLOWED_CHARACTERS_MESSAGE =
  "Може містити лише літери, апострофи та дефіси між частинами";
const PASSWORD_MIN_LENGTH_MESSAGE = "Пароль має бути не менше 8 символів";
const PASSWORD_ALLOWED_CHARACTERS_MESSAGE =
  "Пароль може містити лише латинські літери, цифри та спецсимволи";
const PASSWORD_LOWERCASE_MESSAGE = "Пароль має містити хоча б одну малу латинську літеру";
const PASSWORD_UPPERCASE_MESSAGE = "Пароль має містити хоча б одну велику латинську літеру";
const PASSWORD_SPECIAL_CHARACTER_MESSAGE =
  "Пароль має містити хоча б один спецсимвол: ! @ # $ % & * ? - _ .";

function createPersonNameSchema(fieldLabel: string) {
  return z
    .string()
    .trim()
    .min(1, `${fieldLabel} надто коротке`)
    .regex(personNamePartRegex, {
      message: PERSON_NAME_ALLOWED_CHARACTERS_MESSAGE,
    });
}

const currentPasswordSchema = z.string().min(1, "Введіть поточний пароль");
const deletePasswordSchema = z.string().min(1, "Введіть пароль для підтвердження");
const newPasswordSchema = z
  .string()
  .min(1, "Введіть новий пароль")
  .min(8, PASSWORD_MIN_LENGTH_MESSAGE)
  .regex(passwordAllowedCharactersRegex, PASSWORD_ALLOWED_CHARACTERS_MESSAGE)
  .regex(/[a-z]/, PASSWORD_LOWERCASE_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_UPPERCASE_MESSAGE)
  .regex(passwordSpecialCharacterRegex, PASSWORD_SPECIAL_CHARACTER_MESSAGE);

const emptyExclusiveSelections = (): ProfileTagSelectionsExclusive => ({
  habits: null,
  routine: null,
  social: null,
  pets: null,
});

export function buildInitialTagFormState(
  allTags: readonly ProfileTagRow[],
  selectedTagIds: readonly number[],
): { tagSelections: ProfileTagSelectionsExclusive; tagInterests: number[] } {
  const selected = new Set(selectedTagIds);
  const tagSelections = emptyExclusiveSelections();
  const tagInterests: number[] = [];

  for (const t of allTags) {
    if (!selected.has(t.id)) {
      continue;
    }
    if (t.category === PROFILE_INTERESTS_CATEGORY) {
      tagInterests.push(t.id);
      continue;
    }
    if (t.category === "habits") {
      tagSelections.habits = t.id;
    } else if (t.category === "routine") {
      tagSelections.routine = t.id;
    } else if (t.category === "social") {
      tagSelections.social = t.id;
    } else if (t.category === "pets") {
      tagSelections.pets = t.id;
    }
  }

  return { tagSelections, tagInterests };
}

export function flattenProfileTagIds(data: {
  tagSelections: ProfileTagSelectionsExclusive;
  tagInterests: number[];
}): number[] {
  const { tagSelections, tagInterests } = data;
  const ids = [
    tagSelections.habits,
    tagSelections.routine,
    tagSelections.social,
    tagSelections.pets,
    ...tagInterests,
  ].filter((id): id is number => id !== null && id !== undefined);
  return [...new Set(ids)];
}

export function isTagPayloadConsistentWithIds(
  allTags: readonly ProfileTagRow[],
  uniqueIds: readonly number[],
  expanded: { tagSelections: ProfileTagSelectionsExclusive; tagInterests: number[] },
): boolean {
  const catalogIds = new Set(allTags.map((t) => t.id));
  for (const id of uniqueIds) {
    if (!catalogIds.has(id)) {
      return false;
    }
  }
  const flat = flattenProfileTagIds(expanded);
  const recon = new Set(flat);
  if (uniqueIds.length !== recon.size) {
    return false;
  }
  return uniqueIds.every((id) => recon.has(id));
}

export function createProfileFormSchema(allTags: readonly ProfileTagRow[]) {
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const validIdsForCategory = (category: string) =>
    new Set(allTags.filter((t) => t.category === category).map((t) => t.id));

  const tagSelectionsSchema = z.object({
    habits: z.number().int().nullable(),
    routine: z.number().int().nullable(),
    social: z.number().int().nullable(),
    pets: z.number().int().nullable(),
  });

  return z
    .object({
      firstName: createPersonNameSchema("Ім'я"),
      lastName: createPersonNameSchema("Прізвище"),
      username: z
        .string()
        .min(3, "Мінімум 3 символи")
        .max(40, "Максимум 40 символів")
        .regex(/^[a-zA-Z0-9_]+$/, {
          message: "Тільки латиниця, цифри та '_'",
        }),
      gender: z
        .enum(profileGenderInputValues)
        .refine((v): v is ProfileGenderValue => v === "male" || v === "female", {
          message: "Оберіть стать",
        })
        .transform((v): ProfileGenderValue => v),
      bio: z
        .string()
        .max(1000, "Максимум 1000 символів")
        .optional()
        .transform((value) => value?.trim() ?? ""),
      contactPhone: z
        .string()
        .trim()
        .min(1, "Вкажіть номер телефону")
        .regex(ukrainianPhoneRegex, "Введіть номер у форматі +380XXXXXXXXX"),
      contactTelegram: z
        .string()
        .optional()
        .transform((value) => value?.trim() ?? "")
        .superRefine((value, ctx) => {
          if (value.length === 0) {
            return;
          }

          if (!value.startsWith("@")) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Telegram має починатися з @.",
            });
            return;
          }

          const handle = value.slice(1);
          if (handle.length < 5) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Username у Telegram має містити щонайменше 5 символів після @.",
            });
            return;
          }

          if (handle.length > 32) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Username у Telegram має містити не більше 32 символів.",
            });
            return;
          }

          if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Username у Telegram може містити лише латинські літери, цифри та _.",
            });
          }
        }),
      tagSelections: tagSelectionsSchema,
      tagInterests: z.array(z.number().int()),
    })
    .superRefine((data, ctx) => {
      for (const cat of PROFILE_EXCLUSIVE_CATEGORIES) {
        const id = data.tagSelections[cat];
        if (id === null || id === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Оберіть один варіант",
            path: ["tagSelections", cat],
          });
          continue;
        }
        const row = byId.get(id);
        const allowed = validIdsForCategory(cat);
        if (!row || row.category !== cat || !allowed.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: PROFILE_TAG_CATALOG_CHANGED_MESSAGE,
            path: ["tagSelections", cat],
          });
        }
      }

      const interestAllowed = validIdsForCategory(PROFILE_INTERESTS_CATEGORY);
      for (const id of data.tagInterests) {
        if (!interestAllowed.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: PROFILE_TAG_CATALOG_CHANGED_MESSAGE,
            path: ["tagInterests"],
          });
          break;
        }
      }
    });
}

export type ProfileFormSchema = ReturnType<typeof createProfileFormSchema>;
export type ProfileValues = z.input<ProfileFormSchema>;
export type NormalizedProfileValues = z.output<ProfileFormSchema>;

export const profilePasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: newPasswordSchema,
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

export const profileSetPasswordSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Підтвердіть новий пароль"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Паролі не співпадають",
    path: ["confirmPassword"],
  });

export const profileDeleteSchema = z.object({
  password: deletePasswordSchema,
});

export type ProfilePasswordValues = z.infer<typeof profilePasswordSchema>;
export type ProfileSetPasswordValues = z.infer<typeof profileSetPasswordSchema>;
export type ProfileDeleteValues = z.infer<typeof profileDeleteSchema>;
