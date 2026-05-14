"use client";

import { MoreVertical, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { blockUserAction, unblockUserAction } from "@/app/actions/blocks";
import { ReportDialog } from "@/components/features/reports/report-dialog";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  subjectUserId: string;
  isBlockedByMe: boolean;
  showModerationActions: boolean;
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
  subjectUserId,
  isBlockedByMe,
  showModerationActions,
  displayName,
  subtitle,
  avatarUrl,
  rating,
  reviewsCount,
  bio,
  tags,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reportOpen, setReportOpen] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const ratingLabel = formatPublicRating(rating);

  const handleBlockToggle = () => {
    setMenuError(null);
    startTransition(async () => {
      const res = isBlockedByMe
        ? await unblockUserAction(subjectUserId)
        : await blockUserAction(subjectUserId);
      if (!res.ok) {
        if (
          res.error === "Ви вже заблокували цього користувача. Оновіть сторінку." ||
          res.error === "Користувач вже розблокований. Оновіть сторінку."
        ) {
          try {
            window.sessionStorage.setItem("matefounder.blocks.syncNotice", res.error);
          } catch {
          }
        }
        setMenuError(res.error);
        return;
      }
      router.refresh();
    });
  };

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {displayName}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
            </div>

            {showModerationActions ? (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <DropdownMenu
                  onOpenChange={(next) => {
                    if (next) {
                      setMenuError(null);
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 cursor-pointer text-slate-600"
                      aria-label="Дії щодо профілю"
                      disabled={pending}
                    >
                      <MoreVertical className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        setReportOpen(true);
                      }}
                    >
                      Поскаржитись на користувача
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn("cursor-pointer", !isBlockedByMe && "text-red-600 focus:text-red-600")}
                      disabled={pending}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleBlockToggle();
                      }}
                    >
                      {isBlockedByMe ? "Розблокувати" : "Заблокувати"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ReportDialog
                  targetUserId={subjectUserId}
                  open={reportOpen}
                  onOpenChange={setReportOpen}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
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
            {menuError ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {menuError}
              </p>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Теги</p>
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
