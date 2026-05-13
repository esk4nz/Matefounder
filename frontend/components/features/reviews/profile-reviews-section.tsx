"use client";

import Link from "next/link";

import type { ExistingReviewSummary, ReviewListItem } from "@/app/actions/reviews";
import { ReviewCard } from "@/components/features/reviews/review-card";
import { ReviewForm } from "@/components/features/reviews/review-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function buildReviewsListUrl(userId: string, page: number): string {
  const base = `/profile/${userId}/reviews`;
  if (page <= 1) {
    return base;
  }
  return `${base}?page=${page}`;
}

type Props = {
  targetUserId: string;
  currentUserId: string | null;
  isAllowed: boolean;
  existingReview: ExistingReviewSummary | null;
  reviews: ReviewListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
  };
};

export function ProfileReviewsSection({
  targetUserId,
  currentUserId,
  isAllowed,
  existingReview,
  reviews,
  pagination,
}: Props) {
  const isOwnProfile = currentUserId !== null && currentUserId === targetUserId;
  const showPaginationNav = pagination.totalPages > 1;

  return (
    <div className="grid gap-10">
      {isAllowed ? (
        <ReviewForm
          key={existingReview?.id ?? "create"}
          targetUserId={targetUserId}
          existingReview={existingReview}
        />
      ) : null}

      {currentUserId && !isOwnProfile && !isAllowed && !existingReview ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700">
          Залишити відгук можна лише після прийнятого запиту на співпроживання з цим користувачем.
        </p>
      ) : null}

      <div className="grid gap-4">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <p className="text-base font-medium text-slate-600">Відгуків поки немає.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} currentUserId={currentUserId} />
          ))
        )}
      </div>

      {showPaginationNav ? (
        <nav
          className={cn(
            "mt-8 flex w-full flex-wrap items-center gap-3",
            pagination.currentPage === 1
              ? "justify-end"
              : pagination.currentPage === pagination.totalPages
                ? "justify-start"
                : "justify-between",
          )}
          aria-label="Пагінація відгуків"
        >
          {pagination.currentPage > 1 ? (
            <Button type="button" variant="outline" className="min-w-[11rem] cursor-pointer" asChild>
              <Link href={buildReviewsListUrl(targetUserId, pagination.currentPage - 1)} scroll={false}>
                Попередня
              </Link>
            </Button>
          ) : null}
          {pagination.currentPage < pagination.totalPages ? (
            <Button type="button" variant="outline" className="min-w-[11rem] cursor-pointer" asChild>
              <Link href={buildReviewsListUrl(targetUserId, pagination.currentPage + 1)} scroll={false}>
                Наступна
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
