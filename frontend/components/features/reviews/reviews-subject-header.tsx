import { UserRound } from "lucide-react";

import type { ProfileTagRow } from "@/components/features/profile/profile-types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  displayName: string;
  subtitle: string;
  avatarUrl: string | null;
  rating: number;
  reviewsCount: number;
  bio: string | null;
  tags: ProfileTagRow[];
};

function formatPublicRating(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function reviewCountLabel(count: number): string {
  const n = Math.abs(Math.floor(count));
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${n} відгуків`;
  }
  if (mod10 === 1) {
    return `${n} відгук`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${n} відгуки`;
  }
  return `${n} відгуків`;
}

export function ReviewsSubjectHeader({
  displayName,
  subtitle,
  avatarUrl,
  rating,
  reviewsCount,
  bio,
  tags,
}: Props) {
  const ratingLabel = formatPublicRating(rating);

  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex shrink-0 justify-center sm:justify-start">
          <div className="flex size-28 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-inner sm:size-32">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="size-14 text-slate-400" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {rating > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-bold text-amber-900 ring-1 ring-amber-200/80">
                <span aria-hidden className="text-amber-500">
                  ★
                </span>
                <span>{ratingLabel}</span>
                <span className="font-semibold text-amber-800/90">
                  ({reviewCountLabel(reviewsCount)})
                </span>
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 ring-1 ring-slate-200/80">
                Немає оцінок
              </span>
            )}
          </div>

          {tags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Теги
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    className={cn(
                      "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm",
                      tag.category === "interests" ? "border-blue-200 bg-blue-50/80 text-blue-900" : "",
                    )}
                  >
                    {tag.label_uk}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {bio?.trim() ? (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Опис</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{bio.trim()}</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
