import { PROFILE_EXCLUSIVE_CATEGORIES, PROFILE_INTERESTS_CATEGORY } from "@/app/schemas/profile";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";

export type MinimalProfileForCompleteness = {
  first_name?: string | null;
  last_name?: string | null;
  contact_phone?: string | null;
};

export function collectMissingSeekerProfileFields(input: {
  profile: MinimalProfileForCompleteness;
  selectedTagIds: Iterable<number>;
  allTagRows: ProfileTagRow[];
}): string[] {
  const missingFields: string[] = [];
  if (!input.profile.first_name?.trim()) {
    missingFields.push("ім'я");
  }
  if (!input.profile.last_name?.trim()) {
    missingFields.push("прізвище");
  }
  if (!input.profile.contact_phone?.trim()) {
    missingFields.push("номер телефону");
  }

  const selectedTagIds = new Set(input.selectedTagIds);
  const selectedRequiredCategories = new Set<string>();
  for (const row of input.allTagRows) {
    if (!selectedTagIds.has(row.id)) {
      continue;
    }
    if (row.category !== PROFILE_INTERESTS_CATEGORY) {
      selectedRequiredCategories.add(row.category);
    }
  }

  const hasAllRequiredTagCategories = PROFILE_EXCLUSIVE_CATEGORIES.every((category) =>
    selectedRequiredCategories.has(category),
  );

  if (!hasAllRequiredTagCategories) {
    missingFields.push("обов'язкові теги профілю");
  }

  return missingFields;
}
