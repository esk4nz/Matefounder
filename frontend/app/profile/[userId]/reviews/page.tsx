import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { checkBlockStatusAction } from "@/app/actions/blocks";
import { checkReviewEligibilityAction, getReviewsAction } from "@/app/actions/reviews";
import { REVIEWS_PAGE_SIZE } from "@/app/schemas/reviews";
import { ProfileReviewsSection } from "@/components/features/reviews/profile-reviews-section";
import { ReviewsSubjectHeader } from "@/components/features/reviews/reviews-subject-header";
import type { TagsWithCategoryQueryRow } from "@/lib/profile/map-tags";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { PAGE_SHELL_CLASS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

type ReviewsPublicPageProps = {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ page?: string }>;
};

function parseReviewsPage(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    return 1;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return n;
}

export default async function ReviewsPublicPage({ params, searchParams }: ReviewsPublicPageProps) {
  const { userId } = await params;
  const sp = (await searchParams) ?? {};
  const page = parseReviewsPage(sp.page);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/profile/${userId}/reviews`)}`);
  }

  const [profileRes, tagsRes, reviewsRes, eligibility, isBlockedByMe] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_path, bio, rating, reviews_count")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("profile_tags")
      .select(`tags (${TAGS_WITH_CATEGORY_SELECT})`)
      .eq("profile_id", userId),
    getReviewsAction(userId, page),
    checkReviewEligibilityAction(userId),
    checkBlockStatusAction(userId),
  ]);

  const { data: profile, error: profileError } = profileRes;
  if (profileError || !profile) {
    notFound();
  }

  const tagRelationRows = tagsRes.data ?? [];
  const tagQueryRows: TagsWithCategoryQueryRow[] = [];
  for (const row of tagRelationRows) {
    const rel = row.tags as TagsWithCategoryQueryRow | TagsWithCategoryQueryRow[] | null;
    if (Array.isArray(rel)) {
      for (const t of rel) {
        if (t?.id != null) {
          tagQueryRows.push(t);
        }
      }
    } else if (rel && typeof rel === "object" && rel.id != null) {
      tagQueryRows.push(rel);
    }
  }
  const tags = mapTagsQueryToProfileRows(tagQueryRows);

  const displayName =
    profile.username?.trim() ||
    [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(" ") ||
    "Користувач";

  const subtitle = profile.username?.trim()
    ? [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(" ") || "Профіль"
    : "Профіль користувача";

  const avatarPath =
    typeof profile.avatar_path === "string" && profile.avatar_path.length > 0
      ? profile.avatar_path
      : null;
  const avatarUrl = avatarPath
    ? supabase.storage.from("profile-images").getPublicUrl(avatarPath).data.publicUrl
    : null;

  const rating = typeof profile.rating === "number" ? profile.rating : 0;
  const reviewsCount = typeof profile.reviews_count === "number" ? profile.reviews_count : 0;

  const eligibilityOk = eligibility.ok && eligibility.authenticated;
  const isAllowed = eligibilityOk ? eligibility.isAllowed : false;
  const existingReview = eligibilityOk ? eligibility.existingReview : null;
  const eligibilityError = !eligibility.ok ? eligibility.message : null;

  const totalPages =
    reviewsRes.ok && reviewsRes.totalCount > 0
      ? Math.max(1, Math.ceil(reviewsRes.totalCount / REVIEWS_PAGE_SIZE))
      : 1;

  return (
    <section className={PAGE_SHELL_CLASS}>
      <div className="space-y-10">
        <ReviewsSubjectHeader
          subjectUserId={userId}
          isBlockedByMe={isBlockedByMe}
          showModerationActions={user.id !== userId}
          displayName={displayName}
          subtitle={subtitle}
          avatarUrl={avatarUrl}
          rating={rating}
          reviewsCount={reviewsCount}
          bio={profile.bio}
          tags={tags}
        />

        {!reviewsRes.ok ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-800">
            {reviewsRes.message}
          </div>
        ) : null}

        {eligibilityError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-900">
            {eligibilityError}
          </div>
        ) : null}

        {reviewsRes.ok ? (
          <>
            <ProfileReviewsSection
              targetUserId={userId}
              currentUserId={user.id}
              isAllowed={isAllowed}
              existingReview={existingReview}
              reviews={reviewsRes.reviews}
            />

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
                <p className="text-sm font-medium text-slate-600">
                  Сторінка {reviewsRes.page} з {totalPages}
                </p>
                <div className="flex flex-wrap gap-2">
                  {reviewsRes.page > 1 ? (
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                      <Link
                        href={
                          reviewsRes.page === 2
                            ? `/profile/${userId}/reviews`
                            : `/profile/${userId}/reviews?page=${reviewsRes.page - 1}`
                        }
                        scroll={false}
                      >
                        Назад
                      </Link>
                    </Button>
                  ) : null}
                  {reviewsRes.page < totalPages ? (
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                      <Link href={`/profile/${userId}/reviews?page=${reviewsRes.page + 1}`} scroll={false}>
                        Далі
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
