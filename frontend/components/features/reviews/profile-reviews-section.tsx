"use client";

import type { ExistingReviewSummary, ReviewListItem } from "@/app/actions/reviews";
import { ReviewCard } from "@/components/features/reviews/review-card";
import { ReviewForm } from "@/components/features/reviews/review-form";

type Props = {
  targetUserId: string;
  currentUserId: string | null;
  isAllowed: boolean;
  existingReview: ExistingReviewSummary | null;
  reviews: ReviewListItem[];
};

export function ProfileReviewsSection({
  targetUserId,
  currentUserId,
  isAllowed,
  existingReview,
  reviews,
}: Props) {
  const isOwnProfile = currentUserId !== null && currentUserId === targetUserId;

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
    </div>
  );
}
