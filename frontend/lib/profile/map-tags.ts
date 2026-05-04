import {
  PROFILE_INTERESTS_CATEGORY,
  type ProfileExclusiveTagCategory,
} from "@/app/schemas/profile";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";

export type TagsWithCategoryQueryRow = {
  id: number;
  slug: string;
  label_uk: string;
  category_id: number;
  tag_categories: unknown;
};

const UK_NAME_TO_APP_CATEGORY: Record<
  string,
  ProfileExclusiveTagCategory | typeof PROFILE_INTERESTS_CATEGORY
> = {
  Звички: "habits",
  Режим: "routine",
  Соціальність: "social",
  Тварини: "pets",
  Інтереси: PROFILE_INTERESTS_CATEGORY,
};

export const TAGS_WITH_CATEGORY_SELECT = "id, slug, label_uk, category_id, tag_categories(name)";

export function mapTagsQueryToProfileRows(
  rows: readonly TagsWithCategoryQueryRow[] | null | undefined,
): ProfileTagRow[] {
  if (!rows?.length) {
    return [];
  }
  const out: ProfileTagRow[] = [];
  for (const row of rows) {
    const rel = row.tag_categories as
      | { name?: string | null }
      | ReadonlyArray<{ name?: string | null }>
      | null
      | undefined;
    const name = (Array.isArray(rel) ? rel[0] : rel)?.name?.trim();
    if (!name) {
      continue;
    }
    const category = UK_NAME_TO_APP_CATEGORY[name];
    if (!category) {
      continue;
    }
    out.push({
      id: row.id,
      slug: row.slug,
      label_uk: row.label_uk,
      category,
    });
  }
  return out;
}
