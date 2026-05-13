"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";

import {
  REVIEW_ALREADY_LEFT_MESSAGE,
  REVIEW_INSERT_RLS_INACTIVE_REQUEST_MESSAGE,
  REVIEW_NOT_FOUND_MESSAGE,
  REVIEWS_PAGE_SIZE,
  REVIEW_STALE_VERSION_MESSAGE,
  REVIEW_UPDATE_RLS_INACTIVE_REQUEST_MESSAGE,
  deleteReviewPayloadSchema,
  reviewTargetIdSchema,
  upsertReviewPayloadSchema,
  upsertReviewUpdatePayloadSchema,
} from "@/app/schemas/reviews";
import { createClient } from "@/lib/supabase/server";

export type ReviewAuthorPublic = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  avatarUrl: string | null;
};

export type ReviewListItem = {
  id: number;
  author_id: string;
  target_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
  author: ReviewAuthorPublic | null;
};

export type GetReviewsResult =
  | {
      ok: true;
      reviews: ReviewListItem[];
      totalCount: number;
      page: number;
      pageSize: number;
    }
  | { ok: false; message: string };

export type ExistingReviewSummary = {
  id: number;
  rating: number;
  comment: string;
  updated_at: string;
};

export type ReviewEligibilityResult =
  | {
      ok: true;
      authenticated: true;
      isAllowed: boolean;
      existingReview: ExistingReviewSummary | null;
    }
  | {
      ok: true;
      authenticated: false;
      isAllowed: false;
      existingReview: null;
    }
  | { ok: false; message: string };

export type MutationResult =
  | { ok: true }
  | { ok: false; message: string };

function reviewsPath(targetId: string) {
  return `/profile/${targetId}/reviews`;
}

function mapSupabaseError(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("jwt") || msg.includes("session")) {
    return "Сесія недійсна. Увійдіть знову.";
  }
  if (msg.includes("permission") || msg.includes("policy") || msg.includes("rls")) {
    return "Немає прав на цю дію.";
  }
  return "Сталася помилка. Спробуйте ще раз.";
}

function humanZodMessage(message: string | undefined): string {
  const raw = message ?? "";
  if (/invalid input|expected string|received undefined|expected number/i.test(raw)) {
    return "Некоректні дані. Оновіть сторінку та повторіть спробу.";
  }
  return raw.length > 0 ? raw : "Некоректні дані.";
}

function isReviewsPairUniqueViolation(error: PostgrestError | null): boolean {
  if (!error || error.code !== "23505") {
    return false;
  }
  const blob = `${error.details ?? ""} ${error.message ?? ""}`.toLowerCase();
  return blob.includes("reviews_one_per_pair") || (blob.includes("author_id") && blob.includes("target_id"));
}

function isRowLevelSecurityViolation(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }
  if (error.code === "42501") {
    return true;
  }
  const blob = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return blob.includes("row-level security");
}

export async function getReviewsAction(targetId: string, page: number = 1): Promise<GetReviewsResult> {
  const idParse = reviewTargetIdSchema.safeParse(targetId);
  if (!idParse.success) {
    return { ok: false, message: humanZodMessage(idParse.error.issues[0]?.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Потрібна авторизація." };
  }

  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const from = (safePage - 1) * REVIEWS_PAGE_SIZE;
  const to = from + REVIEWS_PAGE_SIZE - 1;

  const { data: rows, error, count } = await supabase
    .from("reviews")
    .select("id, author_id, target_id, rating, comment, created_at, updated_at", { count: "exact" })
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return { ok: false, message: mapSupabaseError(error.message) };
  }

  const list = rows ?? [];
  const authorIds = [...new Set(list.map((r) => r.author_id))];
  let authorsById = new Map<string, ReviewAuthorPublic>();

  if (authorIds.length > 0) {
    const { data: authorRows, error: authorsError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_path")
      .in("id", authorIds);

    if (!authorsError && authorRows) {
      const bucket = supabase.storage.from("profile-images");
      authorsById = new Map(
        authorRows.map((a) => {
          const path =
            typeof a.avatar_path === "string" && a.avatar_path.length > 0 ? a.avatar_path : null;
          const avatarUrl = path ? bucket.getPublicUrl(path).data.publicUrl : null;
          return [
            a.id,
            {
              id: a.id,
              first_name: a.first_name,
              last_name: a.last_name,
              avatar_path: a.avatar_path,
              avatarUrl,
            },
          ];
        }),
      );
    }
  }

  const reviews: ReviewListItem[] = list.map((r) => ({
    id: Number(r.id),
    author_id: r.author_id,
    target_id: r.target_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : "",
    author: authorsById.get(r.author_id) ?? null,
  }));

  return {
    ok: true,
    reviews,
    totalCount: count ?? 0,
    page: safePage,
    pageSize: REVIEWS_PAGE_SIZE,
  };
}

export async function checkReviewEligibilityAction(targetId: string): Promise<ReviewEligibilityResult> {
  const idParse = reviewTargetIdSchema.safeParse(targetId);
  if (!idParse.success) {
    return { ok: false, message: humanZodMessage(idParse.error.issues[0]?.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: true, authenticated: false, isAllowed: false, existingReview: null };
  }

  if (user.id === targetId) {
    return { ok: true, authenticated: true, isAllowed: false, existingReview: null };
  }

  const { data: selfProfile, error: selfErr } = await supabase
    .from("profiles")
    .select("is_blocked")
    .eq("id", user.id)
    .maybeSingle();

  if (selfErr || !selfProfile || selfProfile.is_blocked) {
    return { ok: true, authenticated: true, isAllowed: false, existingReview: null };
  }

  const { data: allowed, error: rpcError } = await supabase.rpc("review_allowed_by_request", {
    p_author: user.id,
    p_target: targetId,
  });

  if (rpcError) {
    return { ok: false, message: mapSupabaseError(rpcError.message) };
  }

  const { data: existingRow } = await supabase
    .from("reviews")
    .select("id, rating, comment, updated_at")
    .eq("author_id", user.id)
    .eq("target_id", targetId)
    .maybeSingle();

  const existingReview: ExistingReviewSummary | null =
    existingRow &&
    typeof existingRow.updated_at === "string" &&
    existingRow.updated_at.length > 0 &&
    typeof existingRow.rating === "number" &&
    typeof existingRow.comment === "string"
      ? {
          id: Number(existingRow.id),
          rating: existingRow.rating,
          comment: existingRow.comment,
          updated_at: existingRow.updated_at,
        }
      : null;

  const isAllowed = Boolean(allowed);

  return {
    ok: true,
    authenticated: true,
    isAllowed,
    existingReview,
  };
}

export async function upsertReviewAction(
  targetId: string,
  rating: number,
  comment: string,
  updatedAt?: string | null,
): Promise<MutationResult> {
  const parsed = upsertReviewPayloadSchema.safeParse({ targetId, rating, comment, updatedAt: updatedAt ?? undefined });
  if (!parsed.success) {
    return { ok: false, message: humanZodMessage(parsed.error.issues[0]?.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Потрібна авторизація." };
  }

  if (user.id === parsed.data.targetId) {
    return { ok: false, message: "Неможливо залишити відгук самому собі." };
  }

  const { data: existingRow, error: existingErr } = await supabase
    .from("reviews")
    .select("id, updated_at")
    .eq("author_id", user.id)
    .eq("target_id", parsed.data.targetId)
    .maybeSingle();

  if (existingErr) {
    return { ok: false, message: mapSupabaseError(existingErr.message) };
  }

  if (existingRow) {
    const trimmedClientVersion =
      typeof parsed.data.updatedAt === "string" && parsed.data.updatedAt.trim().length > 0
        ? parsed.data.updatedAt.trim()
        : null;
    if (!trimmedClientVersion) {
      return { ok: false, message: REVIEW_ALREADY_LEFT_MESSAGE };
    }

    const updateParse = upsertReviewUpdatePayloadSchema.safeParse({
      ...parsed.data,
      updatedAt: trimmedClientVersion,
    });
    if (!updateParse.success) {
      return { ok: false, message: humanZodMessage(updateParse.error.issues[0]?.message) };
    }

    const expectedAt = updateParse.data.updatedAt.trim();
    const { data: updatedRows, error: updateError } = await supabase
      .from("reviews")
      .update({
        rating: updateParse.data.rating,
        comment: updateParse.data.comment,
      })
      .eq("author_id", user.id)
      .eq("target_id", updateParse.data.targetId)
      .eq("updated_at", expectedAt)
      .select("id");

    if (updateError) {
      if (isRowLevelSecurityViolation(updateError)) {
        return { ok: false, message: REVIEW_UPDATE_RLS_INACTIVE_REQUEST_MESSAGE };
      }
      return { ok: false, message: mapSupabaseError(updateError.message) };
    }
    if (!updatedRows?.length) {
      const { data: stillThere } = await supabase
        .from("reviews")
        .select("id, updated_at")
        .eq("author_id", user.id)
        .eq("target_id", updateParse.data.targetId)
        .maybeSingle();
      if (!stillThere) {
        return { ok: false, message: REVIEW_NOT_FOUND_MESSAGE };
      }
      const serverAt = typeof stillThere.updated_at === "string" ? stillThere.updated_at : "";
      if (serverAt !== expectedAt) {
        return { ok: false, message: REVIEW_STALE_VERSION_MESSAGE };
      }
      return { ok: false, message: REVIEW_UPDATE_RLS_INACTIVE_REQUEST_MESSAGE };
    }
  } else {
    const clientVersionForUpdate =
      typeof parsed.data.updatedAt === "string" && parsed.data.updatedAt.trim().length > 0
        ? parsed.data.updatedAt.trim()
        : "";
    if (clientVersionForUpdate.length > 0) {
      const { data: rowForPair } = await supabase
        .from("reviews")
        .select("id")
        .eq("author_id", user.id)
        .eq("target_id", parsed.data.targetId)
        .maybeSingle();
      if (!rowForPair) {
        return { ok: false, message: REVIEW_NOT_FOUND_MESSAGE };
      }
      return { ok: false, message: REVIEW_ALREADY_LEFT_MESSAGE };
    }

    const { error: insertError } = await supabase.from("reviews").insert({
      author_id: user.id,
      target_id: parsed.data.targetId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });

    if (insertError) {
      if (isReviewsPairUniqueViolation(insertError)) {
        return { ok: false, message: REVIEW_ALREADY_LEFT_MESSAGE };
      }
      if (isRowLevelSecurityViolation(insertError)) {
        return { ok: false, message: REVIEW_INSERT_RLS_INACTIVE_REQUEST_MESSAGE };
      }
      return { ok: false, message: mapSupabaseError(insertError.message) };
    }
  }

  revalidatePath(reviewsPath(parsed.data.targetId));
  return { ok: true };
}

export async function deleteReviewAction(
  reviewId: number,
  updatedAt: string,
): Promise<MutationResult> {
  const parsed = deleteReviewPayloadSchema.safeParse({ reviewId, updatedAt });
  if (!parsed.success) {
    return { ok: false, message: humanZodMessage(parsed.error.issues[0]?.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Потрібна авторизація." };
  }

  const expectedAt = parsed.data.updatedAt.trim();

  const { data: row, error: fetchError } = await supabase
    .from("reviews")
    .select("id, target_id, updated_at")
    .eq("id", parsed.data.reviewId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, message: mapSupabaseError(fetchError.message) };
  }

  if (!row) {
    return { ok: false, message: REVIEW_NOT_FOUND_MESSAGE };
  }

  if (typeof row.updated_at !== "string" || row.updated_at !== expectedAt) {
    return { ok: false, message: REVIEW_STALE_VERSION_MESSAGE };
  }

  const { data: deletedRows, error: delError } = await supabase
    .from("reviews")
    .delete()
    .eq("id", parsed.data.reviewId)
    .eq("author_id", user.id)
    .eq("updated_at", expectedAt)
    .select("id");

  if (delError) {
    return { ok: false, message: mapSupabaseError(delError.message) };
  }

  if (!deletedRows?.length) {
    const { data: still } = await supabase.from("reviews").select("id").eq("id", parsed.data.reviewId).maybeSingle();
    if (!still) {
      return { ok: false, message: REVIEW_NOT_FOUND_MESSAGE };
    }
    return { ok: false, message: REVIEW_STALE_VERSION_MESSAGE };
  }

  revalidatePath(reviewsPath(row.target_id));
  return { ok: true };
}
