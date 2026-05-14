"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/require-admin";
import { buildListingDetailsPayload, type ListingDetailsQueryRow } from "@/lib/listings/build-listing-details-payload";
import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const LISTING_DETAILS_SELECT = `
  id,
  title,
  type,
  gender_preference,
  description,
  price,
  address,
  available_from,
  available_until,
  creator_id,
  is_active,
  updated_at,
  listing_images(image_path, order_index),
  cities(name, regions(name)),
  listing_required_tags(tags(id, slug, label_uk, category_id, tag_categories(name))),
  profiles!listings_creator_id_fkey(
    first_name,
    last_name,
    gender,
    bio,
    rating,
    reviews_count,
    profile_tags(tags(id, slug, label_uk, category_id, tag_categories(name)))
  ),
  listing_requests(count)
`;

async function requireAdminOrRedirect(): Promise<{ userId: string }> {
  const gate = await requireAdminSession();
  if (!gate.ok) {
    if (gate.reason === "forbidden") {
      redirect("/?error=admin_required");
    }
    redirect("/");
  }
  return { userId: gate.userId };
}

const STALE_REPORT_MESSAGE =
  "Цю скаргу вже було оброблено іншим модератором. Оновіть сторінку.";

const STALE_USER_STATUS_MESSAGE =
  "Статус користувача змінився. Оновіть список і спробуйте ще раз.";

const ADMIN_REPORTS_PAGE_SIZE = 15;

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_path: string | null;
  is_admin: boolean | null;
};

type ReviewRow = {
  id: number;
  comment: string;
  rating: number;
};

type ReportFlatRow = {
  id: number;
  reason: string;
  created_at: string;
  updated_at: string;
  status: string;
  target_review_id: number | null;
  target_listing_id: string | null;
  reporter_id: string;
  target_user_id: string;
};

type ReportInboxQueryRow = ReportFlatRow & {
  profiles?: { is_blocked: boolean } | { is_blocked: boolean }[] | null;
};

function reportRowWithoutEmbed(raw: ReportInboxQueryRow): ReportFlatRow {
  const { profiles, ...rest } = raw;
  void profiles;
  return rest;
}

function profileMapFromRows(rows: ProfileRow[]): Map<string, ProfileRow> {
  const m = new Map<string, ProfileRow>();
  for (const p of rows) {
    m.set(p.id, p);
  }
  return m;
}

export type AdminReportObjectKind = "profile" | "review" | "listing";

export type AdminReportRow = {
  id: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
  reporter: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  target: {
    id: string;
    username: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
  objectKind: AdminReportObjectKind;
  targetListingId: string | null;
  review: { id: number; comment: string; rating: number } | null;
};

function usernameAtMention(p: ProfileRow): string {
  const u = p.username?.trim();
  return u ? `@${u}` : "—";
}

function mapReportRow(
  raw: ReportFlatRow,
  profiles: Map<string, ProfileRow>,
  reviews: Map<number, ReviewRow>,
  admin: ReturnType<typeof createServiceRoleClient>,
): AdminReportRow | null {
  const reporter = profiles.get(raw.reporter_id);
  const target = profiles.get(raw.target_user_id);
  if (!reporter || !target) {
    return null;
  }
  const bucket = admin.storage.from("profile-images");
  const reporterAvatar = reporter.avatar_path
    ? bucket.getPublicUrl(reporter.avatar_path).data.publicUrl
    : null;
  const targetAvatar = target.avatar_path
    ? bucket.getPublicUrl(target.avatar_path).data.publicUrl
    : null;

  const hasListing = raw.target_listing_id != null && String(raw.target_listing_id).length > 0;
  const reviewId =
    raw.target_review_id != null && Number.isFinite(raw.target_review_id)
      ? raw.target_review_id
      : null;
  const reviewRow = reviewId != null ? reviews.get(reviewId) : undefined;

  let objectKind: AdminReportObjectKind = "profile";
  if (hasListing) {
    objectKind = "listing";
  } else if (reviewId != null) {
    objectKind = "review";
  }

  return {
    id: raw.id,
    reason: raw.reason,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    reporter: {
      id: reporter.id,
      username: usernameAtMention(reporter),
      avatarUrl: reporterAvatar,
    },
    target: {
      id: target.id,
      username: usernameAtMention(target),
      avatarUrl: targetAvatar,
      isAdmin: target.is_admin === true,
    },
    objectKind,
    targetListingId: hasListing ? String(raw.target_listing_id) : null,
    review:
      reviewRow != null
        ? { id: reviewRow.id, comment: reviewRow.comment, rating: reviewRow.rating }
        : null,
  };
}

export async function listAdminReportsAction(options?: {
  offset?: number;
}): Promise<
  { ok: true; reports: AdminReportRow[]; hasMore: boolean } | { ok: false; message: string }
> {
  await requireAdminOrRedirect();
  const admin = createServiceRoleClient();
  const offset = Math.max(0, options?.offset ?? 0);
  const fetchLimit = ADMIN_REPORTS_PAGE_SIZE + 1;

  const { data: reportRows, error: reportErr } = await admin
    .from("reports")
    .select(
      "id, reason, created_at, updated_at, status, target_review_id, target_listing_id, reporter_id, target_user_id, profiles!reports_target_user_id_fkey!inner(is_blocked)",
    )
    .eq("status", "open")
    .eq("profiles.is_blocked", false)
    .or("report_subject.neq.listing,target_listing_id.not.is.null")
    .or("report_subject.neq.review,target_review_id.not.is.null")
    .order("created_at", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  if (reportErr) {
    return { ok: false, message: "Не вдалося завантажити список скарг." };
  }

  const rawList = (reportRows as ReportInboxQueryRow[] | null | undefined) ?? [];
  const hasMore = rawList.length > ADMIN_REPORTS_PAGE_SIZE;
  const page = hasMore ? rawList.slice(0, ADMIN_REPORTS_PAGE_SIZE) : rawList;

  if (page.length === 0) {
    return { ok: true, reports: [], hasMore };
  }

  const profileIds = new Set<string>();
  const reviewIds = new Set<number>();
  for (const raw of page) {
    const r = reportRowWithoutEmbed(raw);
    profileIds.add(r.reporter_id);
    profileIds.add(r.target_user_id);
    if (r.target_review_id != null && Number.isFinite(r.target_review_id)) {
      reviewIds.add(r.target_review_id);
    }
  }

  const { data: profileRows, error: profileErr } = await admin
    .from("profiles")
    .select("id, username, avatar_path, is_admin")
    .in("id", [...profileIds]);

  if (profileErr) {
    return { ok: false, message: "Не вдалося завантажити список скарг." };
  }

  let reviewRows: ReviewRow[] = [];
  if (reviewIds.size > 0) {
    const { data: revData, error: revErr } = await admin
      .from("reviews")
      .select("id, comment, rating")
      .in("id", [...reviewIds]);
    if (revErr) {
      return { ok: false, message: "Не вдалося завантажити список скарг." };
    }
    reviewRows = (revData as ReviewRow[] | null | undefined) ?? [];
  }

  const profiles = profileMapFromRows((profileRows as ProfileRow[] | null | undefined) ?? []);
  const reviews = new Map<number, ReviewRow>();
  for (const rv of reviewRows) {
    reviews.set(rv.id, rv);
  }

  const reports: AdminReportRow[] = [];
  for (const raw of page) {
    const r = reportRowWithoutEmbed(raw);
    const mapped = mapReportRow(r, profiles, reviews, admin);
    if (mapped) {
      reports.push(mapped);
    }
  }

  return { ok: true, reports, hasMore };
}

type OpenReportSnapshot = {
  id: number;
  updated_at: string;
  status: string;
  target_user_id: string;
};

async function loadOpenReportOrStale(
  admin: ReturnType<typeof createServiceRoleClient>,
  reportId: number,
  expectedUpdatedAt: string,
): Promise<{ ok: true; row: OpenReportSnapshot } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from("reports")
    .select("id, updated_at, status, target_user_id")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  if (data.status !== "open" || data.updated_at !== expectedUpdatedAt) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  return {
    ok: true,
    row: data as OpenReportSnapshot,
  };
}

export async function dismissAdminReportAction(
  reportId: number,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdminOrRedirect();
  const admin = createServiceRoleClient();
  const gate = await loadOpenReportOrStale(admin, reportId, expectedUpdatedAt);
  if (!gate.ok) {
    return gate;
  }

  const { data: updated, error } = await admin
    .from("reports")
    .update({ status: "dismissed" })
    .eq("id", reportId)
    .eq("updated_at", expectedUpdatedAt)
    .eq("status", "open")
    .select("id");

  if (error) {
    return { ok: false, message: "Не вдалося оновити скаргу." };
  }
  if (!updated?.length) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  revalidatePath("/admin/complaints");
  return { ok: true };
}

export async function resolveAdminReportDeleteContentAction(
  reportId: number,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdminOrRedirect();
  const admin = createServiceRoleClient();

  const { data: before, error: readErr } = await admin
    .from("reports")
    .select("id, updated_at, status, target_review_id, target_listing_id")
    .eq("id", reportId)
    .maybeSingle();

  if (readErr || !before) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  if (before.status !== "open" || before.updated_at !== expectedUpdatedAt) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  const listingId =
    typeof before.target_listing_id === "string" && before.target_listing_id.length > 0
      ? before.target_listing_id
      : null;
  const reviewId =
    typeof before.target_review_id === "number" && Number.isFinite(before.target_review_id)
      ? before.target_review_id
      : null;

  if (listingId) {
    const { data: imageRows } = await admin
      .from("listing_images")
      .select("image_path")
      .eq("listing_id", listingId);
    const imagePaths = (imageRows ?? [])
      .map((r) => r.image_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);

    const { data: deletedListings, error: delListingErr } = await admin
      .from("listings")
      .delete()
      .eq("id", listingId)
      .select("id");
    if (delListingErr) {
      return { ok: false, message: "Не вдалося видалити оголошення." };
    }
    if (!deletedListings?.length) {
      return { ok: false, message: "Оголошення не знайдено або вже видалено." };
    }
    if (imagePaths.length > 0) {
      await admin.storage.from("listing-images").remove(imagePaths);
    }
  } else if (reviewId != null) {
    const { data: revMeta } = await admin
      .from("reviews")
      .select("target_id")
      .eq("id", reviewId)
      .maybeSingle();
    const { data: deletedReviews, error: delReviewErr } = await admin
      .from("reviews")
      .delete()
      .eq("id", reviewId)
      .select("id");
    if (delReviewErr) {
      return { ok: false, message: "Не вдалося видалити відгук." };
    }
    if (!deletedReviews?.length) {
      return { ok: false, message: "Відгук не знайдено або вже видалено." };
    }
    if (typeof revMeta?.target_id === "string" && revMeta.target_id.length > 0) {
      revalidatePath(`/profile/${revMeta.target_id}/reviews`, "page");
    }
  } else {
    return { ok: false, message: "Для цієї скарги немає контенту для видалення." };
  }

  const { data: after, error: afterErr } = await admin
    .from("reports")
    .select("id, updated_at, status")
    .eq("id", reportId)
    .maybeSingle();

  if (afterErr || !after) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  if (after.status !== "open") {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  const { data: reviewedRows, error: resolveErr } = await admin
    .from("reports")
    .update({ status: "reviewed" })
    .eq("id", reportId)
    .eq("updated_at", after.updated_at)
    .eq("status", "open")
    .select("id");

  if (resolveErr) {
    return { ok: false, message: "Не вдалося завершити обробку скарги." };
  }
  if (!reviewedRows?.length) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  revalidatePath("/admin/complaints");
  revalidatePath("/listings");
  return { ok: true };
}

export async function resolveAdminReportDeleteAndBlockAction(
  reportId: number,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId: moderatorUserId } = await requireAdminOrRedirect();
  const admin = createServiceRoleClient();

  const { data: before, error: readErr } = await admin
    .from("reports")
    .select(
      "id, updated_at, status, target_review_id, target_listing_id, target_user_id",
    )
    .eq("id", reportId)
    .maybeSingle();

  if (readErr || !before) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  if (before.status !== "open" || before.updated_at !== expectedUpdatedAt) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  const targetUserId =
    typeof before.target_user_id === "string" && before.target_user_id.length > 0
      ? before.target_user_id
      : null;
  if (!targetUserId) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  if (targetUserId === moderatorUserId) {
    return {
      ok: false,
      message: "Неможливо заблокувати користувача для власного облікового запису.",
    };
  }

  const { data: targetProfile, error: tpErr } = await admin
    .from("profiles")
    .select("is_admin, updated_at")
    .eq("id", targetUserId)
    .maybeSingle();

  if (tpErr || !targetProfile) {
    return { ok: false, message: "Користувача не знайдено." };
  }
  if (targetProfile.is_admin === true) {
    return {
      ok: false,
      message: "Неможливо заблокувати іншого адміністратора.",
    };
  }

  const profileUpdatedAt =
    typeof targetProfile.updated_at === "string" ? targetProfile.updated_at : "";
  if (!profileUpdatedAt) {
    return { ok: false, message: STALE_USER_STATUS_MESSAGE };
  }

  const listingId =
    typeof before.target_listing_id === "string" && before.target_listing_id.length > 0
      ? before.target_listing_id
      : null;
  const reviewId =
    typeof before.target_review_id === "number" && Number.isFinite(before.target_review_id)
      ? before.target_review_id
      : null;

  if (listingId) {
    const { data: imageRows } = await admin
      .from("listing_images")
      .select("image_path")
      .eq("listing_id", listingId);
    const imagePaths = (imageRows ?? [])
      .map((r) => r.image_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);

    const { data: deletedListings, error: delListingErr } = await admin
      .from("listings")
      .delete()
      .eq("id", listingId)
      .select("id");
    if (delListingErr) {
      return { ok: false, message: "Не вдалося видалити оголошення." };
    }
    if (!deletedListings?.length) {
      return { ok: false, message: "Оголошення не знайдено або вже видалено." };
    }
    if (imagePaths.length > 0) {
      await admin.storage.from("listing-images").remove(imagePaths);
    }
  } else if (reviewId != null) {
    const { data: revMeta } = await admin
      .from("reviews")
      .select("target_id")
      .eq("id", reviewId)
      .maybeSingle();
    const { data: deletedReviews, error: delReviewErr } = await admin
      .from("reviews")
      .delete()
      .eq("id", reviewId)
      .select("id");
    if (delReviewErr) {
      return { ok: false, message: "Не вдалося видалити відгук." };
    }
    if (!deletedReviews?.length) {
      return { ok: false, message: "Відгук не знайдено або вже видалено." };
    }
    if (typeof revMeta?.target_id === "string" && revMeta.target_id.length > 0) {
      revalidatePath(`/profile/${revMeta.target_id}/reviews`, "page");
    }
  } else {
    return { ok: false, message: "Для цієї скарги немає контенту для видалення." };
  }

  const { data: after, error: afterErr } = await admin
    .from("reports")
    .select("id, updated_at, status")
    .eq("id", reportId)
    .maybeSingle();

  if (afterErr || !after) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  if (after.status !== "open") {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  const { data: blockedRows, error: blockErr } = await admin
    .from("profiles")
    .update({ is_blocked: true })
    .eq("id", targetUserId)
    .eq("updated_at", profileUpdatedAt)
    .select("id");

  if (blockErr) {
    return { ok: false, message: "Не вдалося заблокувати користувача." };
  }
  if (!blockedRows?.length) {
    return { ok: false, message: STALE_USER_STATUS_MESSAGE };
  }

  const { data: reviewedRows, error: resolveErr } = await admin
    .from("reports")
    .update({ status: "reviewed" })
    .eq("id", reportId)
    .eq("updated_at", after.updated_at)
    .eq("status", "open")
    .select("id");

  if (resolveErr) {
    return { ok: false, message: "Не вдалося завершити обробку скарги." };
  }
  if (!reviewedRows?.length) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/complaints");
  revalidatePath("/listings");
  revalidatePath(`/profile/${targetUserId}/reviews`, "page");
  return { ok: true };
}

export async function resolveAdminReportBlockTargetAction(
  reportId: number,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId: moderatorUserId } = await requireAdminOrRedirect();
  const admin = createServiceRoleClient();

  const gate = await loadOpenReportOrStale(admin, reportId, expectedUpdatedAt);
  if (!gate.ok) {
    return gate;
  }

  const targetUserId = gate.row.target_user_id;
  if (typeof targetUserId !== "string" || !targetUserId) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }
  if (targetUserId === moderatorUserId) {
    return {
      ok: false,
      message: "Неможливо заблокувати користувача для власного облікового запису.",
    };
  }

  const { data: targetProfile, error: tpErr } = await admin
    .from("profiles")
    .select("is_admin, updated_at")
    .eq("id", targetUserId)
    .maybeSingle();

  if (tpErr || !targetProfile) {
    return { ok: false, message: "Користувача не знайдено." };
  }
  if (targetProfile.is_admin === true) {
    return {
      ok: false,
      message: "Неможливо заблокувати іншого адміністратора.",
    };
  }

  const profileUpdatedAt =
    typeof targetProfile.updated_at === "string" ? targetProfile.updated_at : "";
  if (!profileUpdatedAt) {
    return { ok: false, message: STALE_USER_STATUS_MESSAGE };
  }

  const { data: blockedRows, error: blockErr } = await admin
    .from("profiles")
    .update({ is_blocked: true })
    .eq("id", targetUserId)
    .eq("updated_at", profileUpdatedAt)
    .select("id");

  if (blockErr) {
    return { ok: false, message: "Не вдалося заблокувати користувача." };
  }
  if (!blockedRows?.length) {
    return { ok: false, message: STALE_USER_STATUS_MESSAGE };
  }

  const { data: reviewedRows, error: resolveErr } = await admin
    .from("reports")
    .update({ status: "reviewed" })
    .eq("id", reportId)
    .eq("updated_at", expectedUpdatedAt)
    .eq("status", "open")
    .select("id");

  if (resolveErr) {
    return { ok: false, message: "Не вдалося завершити обробку скарги." };
  }
  if (!reviewedRows?.length) {
    return { ok: false, message: STALE_REPORT_MESSAGE };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/complaints");
  revalidatePath(`/profile/${targetUserId}/reviews`, "page");
  return { ok: true };
}

export async function getAdminReportListingPreviewAction(
  listingId: string,
): Promise<
  { ok: true; details: ListingDetailsPayload } | { ok: false; message: string }
> {
  await requireAdminOrRedirect();
  const trimmed = listingId.trim();
  if (!trimmed) {
    return { ok: false, message: "Некоректний ідентифікатор оголошення." };
  }

  const admin = createServiceRoleClient();
  const { data: listingRow, error } = await admin
    .from("listings")
    .select(LISTING_DETAILS_SELECT)
    .eq("id", trimmed)
    .maybeSingle();

  if (error || !listingRow) {
    return { ok: false, message: "Оголошення не знайдено або вже видалено." };
  }

  const row = listingRow as ListingDetailsQueryRow;
  const details = buildListingDetailsPayload(row, { supabase: admin });
  return { ok: true, details };
}
