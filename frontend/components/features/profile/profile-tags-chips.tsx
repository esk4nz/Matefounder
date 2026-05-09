import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Controller, useFormState } from "react-hook-form";
import type { NormalizedProfileValues, ProfileValues } from "@/app/schemas/profile";
import {
  PROFILE_EXCLUSIVE_CATEGORIES,
  PROFILE_INTERESTS_CATEGORY,
} from "@/app/schemas/profile";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";
import { FieldError } from "@/components/features/profile/profile-form-feedback";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
  habits: "Звички",
  routine: "Ритм дня",
  social: "Гості та спілкування",
  pets: "Тварини",
  [PROFILE_INTERESTS_CATEGORY]: "Інтереси",
};

const CATEGORY_RENDER_ORDER = [
  ...PROFILE_EXCLUSIVE_CATEGORIES,
  PROFILE_INTERESTS_CATEGORY,
] as const;

type Props = {
  form: UseFormReturn<ProfileValues, undefined, NormalizedProfileValues>;
  allTags: ProfileTagRow[];
};

export function ProfileTagsChips({ form, allTags }: Props) {
  const { errors } = useFormState({ control: form.control });

  const grouped = useMemo(() => {
    const map = new Map<string, ProfileTagRow[]>();
    for (const t of allTags) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return CATEGORY_RENDER_ORDER.flatMap((category) => {
      const tags = map.get(category);
      return tags?.length ? [{ category, tags }] : [];
    });
  }, [allTags]);

  if (!grouped.length) {
    return null;
  }

  return (
    <div className="grid gap-6 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
      <p className="text-sm font-semibold text-slate-800">Теги профілю</p>
      {grouped.map(({ category, tags }) => {
        const title = SECTION_LABELS[category] ?? category;
        const isExclusive = category !== PROFILE_INTERESTS_CATEGORY;

        if (isExclusive) {
          const cat = category as (typeof PROFILE_EXCLUSIVE_CATEGORIES)[number];
          return (
            <div key={category} className="grid gap-2">
              <Label className={errors.tagSelections?.[cat] ? "text-red-500" : "text-slate-700"}>
                {title}
              </Label>
              <Controller
                control={form.control}
                name={`tagSelections.${cat}`}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const selected = field.value === tag.id;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            field.onChange(tag.id);
                          }}
                          className={cn(
                            "max-w-full cursor-pointer rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm font-semibold leading-snug transition-colors",
                            selected
                              ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
                          )}
                        >
                          {tag.label_uk}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              <FieldError message={errors.tagSelections?.[cat]?.message} />
            </div>
          );
        }

        return (
          <div key={category} className="grid gap-2">
            <Label className={errors.tagInterests ? "text-red-500" : "text-slate-700"}>
              {title}
              <span className="ml-1 font-normal text-slate-500">(можна кілька, опціонально)</span>
            </Label>
            <Controller
              control={form.control}
              name="tagInterests"
              render={({ field }) => {
                const value = field.value ?? [];
                return (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const selected = value.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              field.onChange(value.filter((id) => id !== tag.id));
                            } else {
                              field.onChange([...value, tag.id]);
                            }
                          }}
                          className={cn(
                            "max-w-full cursor-pointer rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm font-semibold leading-snug transition-colors",
                            selected
                              ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
                          )}
                        >
                          {tag.label_uk}
                        </button>
                      );
                    })}
                  </div>
                );
              }}
            />
            <FieldError message={errors.tagInterests?.message} />
          </div>
        );
      })}
    </div>
  );
}
