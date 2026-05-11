"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PROFILE_EXCLUSIVE_CATEGORIES,
  type ProfileExclusiveTagCategory,
} from "@/app/schemas/profile";
import { createListingFormSchema, publicListingsFiltersSchema } from "../schemas/listings";
import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import type {
  GetIncomingRequestsActionResult,
  OwnerIncomingRequestItem,
} from "@/lib/listings/owner-incoming-request-types";
import { collectMissingSeekerProfileFields } from "@/lib/profile/profile-completeness";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { buildListingDetailsPayload, type ListingDetailsQueryRow } from "@/lib/listings/build-listing-details-payload";
import { extractListingIncomingRequestsCount } from "@/lib/listings/listing-requests-count";
import { LISTING_MAX_PHOTOS } from "@/lib/listings/constants";
import { LISTING_FLASH_CODE, type UpdateMyListingActionState } from "@/lib/listings/listing-error-codes";
import type {
  ListingDetailsPayload,
  ListingDetailsReviewSummary,
  ListingRequestStatus,
} from "@/lib/listings/listing-details-types";
import { createClient } from "@/lib/supabase/server";

export type { UpdateMyListingActionState } from "@/lib/listings/listing-error-codes";

export type CreateListingGuardState = {
  ok: boolean;
  message?: string;
  missingFields?: string[];
  reason?: "unauthenticated" | "missingProfile";
};

export type CreateListingActionState = {
  ok: boolean;
  message?: string;
  reason?: "unauthenticated" | "missingProfile";
};

export type MyListingFreshDataActionResult =
  | { ok: false; reason: "unauthenticated" | "notFound" | "unknown" }
  | {
      ok: true;
      details: ListingDetailsPayload;
      card: ListingCardModel;
    };

export type PublicListingFreshDataScope = "discovery" | "my-requests";

export type PublicListingsActionResult =
  | { ok: false; reason: "unauthenticated" | "invalidFilters"; message?: string }
  | { ok: true; listings: ListingCardModel[]; total: number };

export type MyRequestsActionResult =
  | { ok: false; reason: "unauthenticated" | "unknown"; message?: string }
  | { ok: true; listings: ListingCardModel[] };

export type AcceptedContactsActionResult =
  | { ok: false; reason: "unauthenticated" | "forbidden" | "unknown"; message?: string }
  | { ok: true; phone: string | null; telegram: string | null; email: string | null };

export type SimpleListingMutationResult =
  | { ok: false; message: string }
  | { ok: true };

export type UpdateMyListingStatusActionResult =
  | { ok: false; message: string }
  | { ok: true; isActive: boolean; updatedAt: string };

export type DeleteMyListingActionResult =
  | { ok: false; message: string }
  | { ok: true };

export type OwnerRespondToListingRequestResult =
  | { ok: false; message: string }
  | { ok: true };

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
    profile_tags(tags(id, slug, label_uk, category_id, tag_categories(name)))
  ),
  listing_requests(count)
`;

type SeekerBatchContext = {
  requestsByListingId: Map<
    string,
    { status: ListingRequestStatus; similarityScore: number | null; updatedAt: string }
  >;
  blockedByMe: Set<string>;
  blockedByAuthor: Set<string>;
};

const STALE_SEEKER_STATE_MESSAGE = "Дані застаріли. Оновіть сторінку та спробуйте ще раз.";
const LISTING_PEER_BLOCKED_MESSAGE = "Оголошення більше недоступне. Будь ласка, оновіть сторінку.";

async function gateListingPeerInteraction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  opponentId: string,
  _mode: "default" | "strict" = "default",
): Promise<{ ok: true } | { ok: false }> {
  void _mode;
  const [
    { data: opponentProfile },
    { data: actorProfile },
    { data: blockedByActor },
    { data: blockedByOpponent },
  ] = await Promise.all([
    supabase.from("profiles").select("is_blocked").eq("id", opponentId).maybeSingle(),
    supabase.from("profiles").select("is_blocked").eq("id", actorId).maybeSingle(),
    supabase.from("user_blocks").select("blocker_id").eq("blocker_id", actorId).eq("blocked_id", opponentId).maybeSingle(),
    supabase.from("user_blocks").select("blocker_id").eq("blocker_id", opponentId).eq("blocked_id", actorId).maybeSingle(),
  ]);

  if (actorProfile?.is_blocked === true || opponentProfile?.is_blocked === true) {
    return { ok: false };
  }

  if (blockedByActor || blockedByOpponent) {
    return { ok: false };
  }

  return { ok: true };
}

async function gateUnblockListingAuthorPeer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  opponentId: string,
): Promise<{ ok: true } | { ok: false }> {
  const [{ data: opponentProfile }, { data: actorProfile }, { data: blockedByOpponent }] =
    await Promise.all([
      supabase.from("profiles").select("is_blocked").eq("id", opponentId).maybeSingle(),
      supabase.from("profiles").select("is_blocked").eq("id", actorId).maybeSingle(),
      supabase.from("user_blocks").select("blocker_id").eq("blocker_id", opponentId).eq("blocked_id", actorId).maybeSingle(),
    ]);

  if (actorProfile?.is_blocked === true || opponentProfile?.is_blocked === true) {
    return { ok: false };
  }

  if (blockedByOpponent) {
    return { ok: false };
  }

  return { ok: true };
}

async function assertSeekerRequestUpdatedAtMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  listingId: string,
  expectedRequestUpdatedAt: string | null | undefined,
): Promise<boolean> {
  const expected =
    typeof expectedRequestUpdatedAt === "string" ? expectedRequestUpdatedAt.trim() : "";
  if (!expected) {
    return true;
  }
  const { data: reqRow } = await supabase
    .from("listing_requests")
    .select("updated_at")
    .eq("listing_id", listingId)
    .eq("initiator_id", userId)
    .maybeSingle();
  return typeof reqRow?.updated_at === "string" && reqRow.updated_at === expected;
}

async function assertOwnerListingRequestUpdatedAtMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  requestId: string,
  seekerId: string,
  expectedRequestUpdatedAt: string | null | undefined,
): Promise<boolean> {
  const expected =
    typeof expectedRequestUpdatedAt === "string" ? expectedRequestUpdatedAt.trim() : "";
  if (!expected) {
    return true;
  }
  const { data: reqRow } = await supabase
    .from("listing_requests")
    .select("updated_at")
    .eq("id", requestId)
    .eq("listing_id", listingId)
    .eq("initiator_id", seekerId)
    .maybeSingle();
  return typeof reqRow?.updated_at === "string" && reqRow.updated_at === expected;
}

async function loadSeekerBatchContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  listingIds: string[],
): Promise<SeekerBatchContext> {
  const uniqueIds = [...new Set(listingIds)].filter((id) => id.length > 0);
  if (uniqueIds.length === 0) {
    return {
      requestsByListingId: new Map(),
      blockedByMe: new Set(),
      blockedByAuthor: new Set(),
    };
  }

  const [reqRes, outRes, inRes] = await Promise.all([
    supabase
      .from("listing_requests")
      .select("listing_id, status, similarity_score, updated_at")
      .eq("initiator_id", userId)
      .in("listing_id", uniqueIds),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
  ]);

  const requestsByListingId = new Map<
    string,
    { status: ListingRequestStatus; similarityScore: number | null; updatedAt: string }
  >();
  for (const row of reqRes.data ?? []) {
    const lid = typeof row.listing_id === "string" ? row.listing_id : "";
    const st = row.status;
    const updatedAtRaw = row.updated_at;
    const updatedAt = typeof updatedAtRaw === "string" ? updatedAtRaw : "";
    if (lid && updatedAt && (st === "pending" || st === "accepted" || st === "rejected")) {
      const rawScore = row.similarity_score;
      const rounded =
        rawScore != null && rawScore !== ""
          ? Math.round(Number(rawScore))
          : null;
      const similarityScore =
        rounded != null && Number.isFinite(rounded) ? rounded : null;
      requestsByListingId.set(lid, {
        status: st,
        similarityScore,
        updatedAt,
      });
    }
  }

  const blockedByMe = new Set(
    (outRes.data ?? []).map((r) => r.blocked_id).filter((id): id is string => typeof id === "string"),
  );
  const blockedByAuthor = new Set(
    (inRes.data ?? []).map((r) => r.blocker_id).filter((id): id is string => typeof id === "string"),
  );

  return { requestsByListingId, blockedByMe, blockedByAuthor };
}

function applySeekerToListingCard(
  row: ListingDetailsQueryRow,
  detailsBase: ListingDetailsPayload,
  ctx: SeekerBatchContext,
): ListingCardModel {
  const req = ctx.requestsByListingId.get(row.id);
  const requestStatus = req?.status ?? null;
  const requestUpdatedAt = req?.updatedAt ?? null;
  const similarityScore = req?.similarityScore ?? null;
  const isBlockedByMe = ctx.blockedByMe.has(row.creator_id);
  const isBlockedByAuthor = ctx.blockedByAuthor.has(row.creator_id);

  const details: ListingDetailsPayload = {
    ...detailsBase,
    similarityScore,
    requestStatus,
    isBlockedByMe,
    isBlockedByAuthor,
  };

  return {
    id: row.id,
    title: row.title,
    type: details.type,
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    updatedAt: row.updated_at,
    requestUpdatedAt,
    firstImageUrl: details.imageUrls[0] ?? null,
    similarityScore,
    requestStatus,
    isBlockedByMe,
    isBlockedByAuthor,
    details,
  };
}

function joinUkrainianList(parts: string[]) {
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} та ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")} та ${parts[parts.length - 1]}`;
}

type ProfileReadyResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      message: string;
      reason?: "unauthenticated" | "missingProfile";
      missingFields?: string[];
    };

async function assertProfileReadyForListing(): Promise<ProfileReadyResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message: "Сесія завершилася. Увійдіть знову, щоб створити анкету.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("first_name, last_name, contact_phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      reason: "missingProfile",
      message: "Не вдалося знайти профіль. Оновіть сторінку та спробуйте ще раз.",
    };
  }

  const { data: selectedTagRows, error: selectedTagsError } = await supabase
    .from("profile_tags")
    .select("tag_id")
    .eq("profile_id", user.id);

  if (selectedTagsError) {
    return {
      ok: false,
      message: "Не вдалося перевірити теги профілю. Спробуйте ще раз.",
    };
  }

  const { data: allTagRowsRaw, error: allTagsError } = await supabase
    .from("tags")
    .select(TAGS_WITH_CATEGORY_SELECT);

  const allTagRows = mapTagsQueryToProfileRows(allTagRowsRaw);

  if (allTagsError || !allTagRows.length) {
    return {
      ok: false,
      message: "Не вдалося перевірити теги профілю. Спробуйте ще раз.",
    };
  }

  const missingFields = collectMissingSeekerProfileFields({
    profile,
    selectedTagIds: (selectedTagRows ?? []).map((row) => row.tag_id),
    allTagRows,
  });

  if (missingFields.length > 0) {
    return {
      ok: false,
      reason: "missingProfile",
      missingFields,
      message: `Для створення анкети заповніть у профілі: ${joinUkrainianList(missingFields)}.`,
    };
  }

  return { ok: true, userId: user.id };
}

function getFileExtension(filename: string) {
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "jpg";
  if (!extension || extension.length > 8) {
    return "jpg";
  }
  return extension;
}

function isValidImageMimeType(type: string) {
  return type === "image/jpeg" || type === "image/jpg" || type === "image/png" || type === "image/webp";
}

function parseRequiredTagIds(value: FormDataEntryValue | null): number[] {
  try {
    const raw = JSON.parse(String(value ?? "[]")) as unknown;
    if (!Array.isArray(raw)) {
      return [];
    }
    const ints = raw.filter((entry) => Number.isInteger(entry)) as number[];
    return [...new Set(ints)];
  } catch {
    return [];
  }
}

function parseTagSelections(tagIds: readonly number[], allTagRows: ReturnType<typeof mapTagsQueryToProfileRows>) {
  const byId = new Map(allTagRows.map((tag) => [tag.id, tag]));
  const exclusiveSelections: Record<ProfileExclusiveTagCategory, number | null> = {
    habits: null,
    routine: null,
    social: null,
    pets: null,
  };

  for (const tagId of tagIds) {
    const row = byId.get(tagId);
    if (!row) {
      continue;
    }
    if (PROFILE_EXCLUSIVE_CATEGORIES.includes(row.category as ProfileExclusiveTagCategory)) {
      const category = row.category as ProfileExclusiveTagCategory;
      if (!exclusiveSelections[category]) {
        exclusiveSelections[category] = tagId;
      }
    }
  }

  return {
    tagSelections: exclusiveSelections,
  };
}

export async function guardCreateListingAction(
  _prevState: CreateListingGuardState | undefined,
): Promise<CreateListingGuardState> {
  void _prevState;
  const profileReady = await assertProfileReadyForListing();
  if (!profileReady.ok) {
    return {
      ok: false,
      reason: profileReady.reason,
      message: profileReady.message,
      missingFields: profileReady.missingFields,
    };
  }

  redirect("/my-listings/new");
}

export async function createListingAction(
  _prevState: CreateListingActionState | undefined,
  formData: FormData,
): Promise<CreateListingActionState> {
  void _prevState;
  const profileReady = await assertProfileReadyForListing();
  if (!profileReady.ok) {
    return {
      ok: false,
      reason: profileReady.reason,
      message: profileReady.message,
    };
  }

  const supabase = await createClient();
  const requiredTagIds = parseRequiredTagIds(formData.get("requiredTagIds"));
  const imageFiles = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (imageFiles.length === 0) {
    return { ok: false, message: "Додайте щонайменше одне фото для анкети." };
  }
  if (imageFiles.length > LISTING_MAX_PHOTOS) {
    return {
      ok: false,
      message: `Можна завантажити до ${LISTING_MAX_PHOTOS} фото.`,
    };
  }

  for (const file of imageFiles) {
    if (!isValidImageMimeType(file.type)) {
      return {
        ok: false,
        message: "Підтримуються лише зображення JPG, PNG або WEBP.",
      };
    }
    if (file.size > 8 * 1024 * 1024) {
      return {
        ok: false,
        message: "Розмір одного фото не має перевищувати 8 МБ.",
      };
    }
  }

  const { data: allTagRowsRaw, error: allTagsError } = await supabase
    .from("tags")
    .select(TAGS_WITH_CATEGORY_SELECT)
    .order("category_id", { ascending: true })
    .order("slug", { ascending: true });

  const allTagRows = mapTagsQueryToProfileRows(allTagRowsRaw);
  if (allTagsError || !allTagRows.length) {
    return { ok: false, message: "Не вдалося завантажити довідник тегів." };
  }

  const parsedTagPayload = parseTagSelections(requiredTagIds, allTagRows);

  const parsedListing = createListingFormSchema(allTagRows).safeParse({
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    cityId: String(formData.get("cityId") ?? ""),
    genderPreference: String(formData.get("genderPreference") ?? ""),
    description: String(formData.get("description") ?? ""),
    address: String(formData.get("address") ?? ""),
    price: Number(formData.get("price") ?? NaN),
    availableFrom: String(formData.get("availableFrom") ?? ""),
    availableUntil: String(formData.get("availableUntil") ?? ""),
    tagSelections: parsedTagPayload.tagSelections,
  });

  if (!parsedListing.success) {
    const first =
      parsedListing.error.issues[0]?.message ??
      "Перевірте поля анкети та спробуйте ще раз.";
    return {
      ok: false,
      message: first,
    };
  }

  const { data: insertedListingRows, error: insertListingError } = await supabase
    .from("listings")
    .insert({
      creator_id: profileReady.userId,
      type: parsedListing.data.type,
      city_id: parsedListing.data.cityId,
      gender_preference: parsedListing.data.genderPreference,
      price: parsedListing.data.price,
      title: parsedListing.data.title.trim(),
      description: parsedListing.data.description.trim(),
      address: parsedListing.data.address.length ? parsedListing.data.address : null,
      available_from: parsedListing.data.availableFrom,
      available_until: parsedListing.data.availableUntil || null,
      is_active: true,
    })
    .select("id")
    .limit(1);

  if (insertListingError || !insertedListingRows?.length) {
    return { ok: false, message: "Не вдалося створити анкету. Спробуйте ще раз." };
  }

  const listingId = insertedListingRows[0].id;
  const uploadedPaths: string[] = [];

  for (const [index, file] of imageFiles.entries()) {
    const extension = getFileExtension(file.name);
    const storagePath = `${profileReady.userId}/${listingId}/${index + 1}-${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("listing-images").upload(storagePath, file, {
      upsert: false,
      cacheControl: "3600",
    });

    if (uploadError) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("listing-images").remove(uploadedPaths);
      }
      await supabase.from("listings").delete().eq("id", listingId);
      return { ok: false, message: "Не вдалося завантажити фото. Спробуйте ще раз." };
    }

    uploadedPaths.push(storagePath);
  }

  const { error: listingImagesError } = await supabase.from("listing_images").insert(
    uploadedPaths.map((imagePath, index) => ({
      listing_id: listingId,
      image_path: imagePath,
      order_index: index,
    })),
  );

  if (listingImagesError) {
    await supabase.storage.from("listing-images").remove(uploadedPaths);
    await supabase.from("listings").delete().eq("id", listingId);
    return { ok: false, message: "Не вдалося зберегти фото анкети. Спробуйте ще раз." };
  }

  const selectedListingTagIds = Object.values(parsedListing.data.tagSelections).filter(
    (tagId): tagId is number => typeof tagId === "number",
  );

  const { error: listingTagsError } = await supabase.from("listing_required_tags").insert(
    selectedListingTagIds.map((tagId) => ({
      listing_id: listingId,
      tag_id: tagId,
    })),
  );

  if (listingTagsError) {
    await supabase.from("listing_images").delete().eq("listing_id", listingId);
    await supabase.storage.from("listing-images").remove(uploadedPaths);
    await supabase.from("listings").delete().eq("id", listingId);
    return { ok: false, message: "Не вдалося зберегти очікувані теги анкети." };
  }

  redirect("/my-listings");
}

export async function updateMyListingAction(
  _prevState: UpdateMyListingActionState | undefined,
  formData: FormData,
): Promise<UpdateMyListingActionState> {
  void _prevState;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Оновіть сторінку та увійдіть повторно." };
  }

  const listingId = String(formData.get("listingId") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "").trim();
  if (!listingId || !expectedUpdatedAt) {
    return { ok: false, message: "Не вдалося підготувати редагування анкети. Оновіть сторінку та спробуйте ще раз." };
  }

  const requiredTagIds = parseRequiredTagIds(formData.get("requiredTagIds"));
  const keptImagePaths = (() => {
    try {
      const parsed = JSON.parse(String(formData.get("keptImagePaths") ?? "[]")) as unknown;
      if (!Array.isArray(parsed)) {
        return [] as string[];
      }
      return parsed.filter((row): row is string => typeof row === "string" && row.trim().length > 0);
    } catch {
      return [] as string[];
    }
  })();
  const newImageFiles = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (keptImagePaths.length + newImageFiles.length === 0) {
    return { ok: false, message: "Додайте щонайменше одне фото для анкети." };
  }
  if (keptImagePaths.length + newImageFiles.length > LISTING_MAX_PHOTOS) {
    return { ok: false, message: `Можна завантажити до ${LISTING_MAX_PHOTOS} фото.` };
  }
  for (const file of newImageFiles) {
    if (!isValidImageMimeType(file.type)) {
      return { ok: false, message: "Підтримуються лише зображення JPG, PNG або WEBP." };
    }
    if (file.size > 8 * 1024 * 1024) {
      return { ok: false, message: "Розмір одного фото не має перевищувати 8 МБ." };
    }
  }

  const { data: allTagRowsRaw, error: allTagsError } = await supabase
    .from("tags")
    .select(TAGS_WITH_CATEGORY_SELECT)
    .order("category_id", { ascending: true })
    .order("slug", { ascending: true });
  const allTagRows = mapTagsQueryToProfileRows(allTagRowsRaw);
  if (allTagsError || !allTagRows.length) {
    return { ok: false, message: "Не вдалося завантажити довідник тегів." };
  }

  const parsedTagPayload = parseTagSelections(requiredTagIds, allTagRows);
  const parsedListing = createListingFormSchema(allTagRows).safeParse({
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    cityId: String(formData.get("cityId") ?? ""),
    genderPreference: String(formData.get("genderPreference") ?? ""),
    description: String(formData.get("description") ?? ""),
    address: String(formData.get("address") ?? ""),
    price: Number(formData.get("price") ?? NaN),
    availableFrom: String(formData.get("availableFrom") ?? ""),
    availableUntil: String(formData.get("availableUntil") ?? ""),
    tagSelections: parsedTagPayload.tagSelections,
  });

  if (!parsedListing.success) {
    const first =
      parsedListing.error.issues[0]?.message ??
      "Перевірте поля анкети та спробуйте ще раз.";
    return { ok: false, message: first };
  }

  const { data: listingRow, error: listingError } = await supabase
    .from("listings")
    .select("id, updated_at")
    .eq("id", listingId)
    .eq("creator_id", user.id)
    .maybeSingle();
  if (listingError) {
    return { ok: false, message: "Не вдалося перевірити стан оголошення. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!listingRow) {
    return {
      ok: false,
      reason: LISTING_FLASH_CODE.listingNotFound,
    };
  }

  const { data: currentImageRows, error: currentImagesError } = await supabase
    .from("listing_images")
    .select("image_path, order_index")
    .eq("listing_id", listingId)
    .order("order_index", { ascending: true });
  if (currentImagesError) {
    return { ok: false, message: "Не вдалося завантажити поточні фото анкети." };
  }
  const currentImagePaths = (currentImageRows ?? [])
    .map((row) => row.image_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);
  const currentPathSet = new Set(currentImagePaths);
  if (keptImagePaths.some((path) => !currentPathSet.has(path))) {
    return { ok: false, message: "Фото анкети застаріли. Оновіть сторінку та спробуйте ще раз." };
  }

  const uploadedPaths: string[] = [];
  for (const [index, file] of newImageFiles.entries()) {
    const extension = getFileExtension(file.name);
    const storagePath = `${user.id}/${listingId}/edit-${Date.now()}-${index + 1}-${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("listing-images").upload(storagePath, file, {
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("listing-images").remove(uploadedPaths);
      }
      return { ok: false, message: "Не вдалося завантажити фото. Спробуйте ще раз." };
    }
    uploadedPaths.push(storagePath);
  }

  const finalImagePaths = [...keptImagePaths, ...uploadedPaths];
  const { data: updatedRows, error: updateError } = await supabase
    .from("listings")
    .update({
      type: parsedListing.data.type,
      city_id: parsedListing.data.cityId,
      gender_preference: parsedListing.data.genderPreference,
      price: parsedListing.data.price,
      title: parsedListing.data.title.trim(),
      description: parsedListing.data.description.trim(),
      address: parsedListing.data.address.length ? parsedListing.data.address : null,
      available_from: parsedListing.data.availableFrom,
      available_until: parsedListing.data.availableUntil || null,
    })
    .eq("id", listingId)
    .eq("creator_id", user.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");
  if (updateError) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from("listing-images").remove(uploadedPaths);
    }
    return { ok: false, message: "Не вдалося зберегти зміни анкети. Спробуйте ще раз." };
  }
  if (!updatedRows?.length) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from("listing-images").remove(uploadedPaths);
    }
    const { data: stillExists } = await supabase
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("creator_id", user.id)
      .maybeSingle();
    if (!stillExists) {
      return {
        ok: false,
        reason: LISTING_FLASH_CODE.listingNotFound,
      };
    }
    return { ok: false, message: "Дані застаріли. Оновіть сторінку та спробуйте ще раз." };
  }

  const selectedListingTagIds = Object.values(parsedListing.data.tagSelections).filter(
    (tagId): tagId is number => typeof tagId === "number",
  );
  const { error: clearTagsError } = await supabase
    .from("listing_required_tags")
    .delete()
    .eq("listing_id", listingId);
  if (clearTagsError) {
    return { ok: false, message: "Не вдалося завершити оновлення анкети. Спробуйте ще раз." };
  }
  const { error: insertTagsError } = await supabase.from("listing_required_tags").insert(
    selectedListingTagIds.map((tagId) => ({
      listing_id: listingId,
      tag_id: tagId,
    })),
  );
  if (insertTagsError) {
    return { ok: false, message: "Не вдалося завершити оновлення анкети. Спробуйте ще раз." };
  }
  const { error: clearImagesError } = await supabase
    .from("listing_images")
    .delete()
    .eq("listing_id", listingId);
  if (clearImagesError) {
    return { ok: false, message: "Не вдалося завершити оновлення анкети. Спробуйте ще раз." };
  }

  const { error: insertImagesError } = await supabase.from("listing_images").insert(
    finalImagePaths.map((imagePath, index) => ({
      listing_id: listingId,
      image_path: imagePath,
      order_index: index,
    })),
  );
  if (insertImagesError) {
    return { ok: false, message: "Не вдалося зберегти порядок фото анкети. Спробуйте ще раз." };
  }

  const removedPaths = currentImagePaths.filter((path) => !keptImagePaths.includes(path));
  if (removedPaths.length > 0) {
    await supabase.storage.from("listing-images").remove(removedPaths);
  }

  revalidatePath("/my-listings");
  revalidatePath(`/my-listings/${listingId}/edit`);
  return { ok: true };
}

export type CheckMyListingExistsResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "not_found" };

export async function checkMyListingExistsAction(listingId: string): Promise<CheckMyListingExistsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }
  const trimmed = listingId.trim();
  if (!trimmed) {
    return { ok: false, reason: "not_found" };
  }
  const { data } = await supabase
    .from("listings")
    .select("id")
    .eq("id", trimmed)
    .eq("creator_id", user.id)
    .maybeSingle();
  if (!data) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true };
}

export async function getMyListingFreshDataAction(
  listingId: string,
): Promise<MyListingFreshDataActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const [{ data: listingRow }, { data: reviewRatings }] = await Promise.all([
    supabase
      .from("listings")
      .select(LISTING_DETAILS_SELECT)
      .eq("id", listingId)
      .eq("creator_id", user.id)
      .maybeSingle(),
    supabase.from("reviews").select("rating").eq("target_id", user.id),
  ]);

  if (!listingRow) {
    return { ok: false, reason: "notFound" };
  }

  let reviewSummary: ListingDetailsReviewSummary | null = null;
  const ratings = (reviewRatings ?? []).map((r) => r.rating).filter((n) => typeof n === "number");
  if (ratings.length > 0) {
    const avg5 = ratings.reduce((acc, n) => acc + n, 0) / ratings.length;
    reviewSummary = {
      averageOutOf10: avg5 * 2,
      count: ratings.length,
    };
  }

  const row = listingRow as ListingDetailsQueryRow;
  const details = buildListingDetailsPayload(row, {
    supabase,
    reviewSummary,
  });

  return {
    ok: true,
    details,
    card: {
      id: row.id,
      title: row.title,
      type: details.type,
      isActive: typeof row.is_active === "boolean" ? row.is_active : true,
      updatedAt: row.updated_at,
      requestUpdatedAt: null,
      firstImageUrl: details.imageUrls[0] ?? null,
      similarityScore: null,
      requestStatus: null,
      isBlockedByMe: false,
      isBlockedByAuthor: false,
      incomingRequestsCount: extractListingIncomingRequestsCount(row),
      details,
    },
  };
}

function intersectIdList(current: string[] | null, next: string[]): string[] {
  if (current === null) {
    return next;
  }
  const nextSet = new Set(next);
  return current.filter((id) => nextSet.has(id));
}

async function fetchCreatorIdsMatchingAuthorInterests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interestTagIds: number[],
): Promise<string[]> {
  if (interestTagIds.length === 0) {
    return [];
  }
  const uniqueInterestIds = [...new Set(interestTagIds)];
  const { data, error } = await supabase
    .from("profile_tags")
    .select("profile_id, tag_id")
    .in("tag_id", uniqueInterestIds);
  if (error || !data?.length) {
    return [];
  }
  const byCreator = new Map<string, Set<number>>();
  for (const row of data) {
    if (typeof row.profile_id !== "string" || !row.profile_id) {
      continue;
    }
    const set = byCreator.get(row.profile_id) ?? new Set();
    if (typeof row.tag_id === "number") {
      set.add(row.tag_id);
    }
    byCreator.set(row.profile_id, set);
  }
  const required = new Set(uniqueInterestIds);
  const matched: string[] = [];
  for (const [profileId, tagSet] of byCreator) {
    let hasAll = true;
    for (const tid of required) {
      if (!tagSet.has(tid)) {
        hasAll = false;
        break;
      }
    }
    if (hasAll) {
      matched.push(profileId);
    }
  }
  return matched;
}

export async function getPublicListingsAction(
  rawFilters: unknown,
): Promise<PublicListingsActionResult> {
  const parsed = publicListingsFiltersSchema.safeParse(rawFilters ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Некоректні параметри фільтрації.";
    return { ok: false, reason: "invalidFilters", message: first };
  }

  const filters = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const [outgoingBlocksResult, incomingBlocksResult] = await Promise.all([
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
    supabase.from("user_blocks").select("blocker_id").eq("blocked_id", user.id),
  ]);

  if (outgoingBlocksResult.error || incomingBlocksResult.error) {
    return { ok: false, reason: "invalidFilters", message: "Не вдалося застосувати обмеження профілю." };
  }

  const blockedIds = [
    ...new Set(
      [
        ...(outgoingBlocksResult.data ?? []).map((row) => row.blocked_id),
        ...(incomingBlocksResult.data ?? []).map((row) => row.blocker_id),
      ].filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  let creatorIdRestriction: string[] | null = null;

  const authorGender = filters.authorGender;
  if (authorGender === "male" || authorGender === "female") {
    const { data: genderRows, error: genderError } = await supabase.from("profiles").select("id").eq("gender", authorGender);
    if (genderError) {
      return { ok: false, reason: "invalidFilters", message: "Не вдалося застосувати фільтр за статтю автора." };
    }
    const genderIds = [...new Set((genderRows ?? []).map((r) => r.id).filter((id): id is string => typeof id === "string" && id.length > 0))];
    creatorIdRestriction = intersectIdList(creatorIdRestriction, genderIds);
    if (creatorIdRestriction.length === 0) {
      return { ok: true, listings: [], total: 0 };
    }
  }

  for (const cat of PROFILE_EXCLUSIVE_CATEGORIES) {
    const tagsForCat = filters.requiredTags?.[cat];
    if (tagsForCat && tagsForCat.length > 0) {
      const { data: tagRows, error: tagError } = await supabase
        .from("profile_tags")
        .select("profile_id")
        .in("tag_id", tagsForCat);
      if (tagError) {
        return { ok: false, reason: "invalidFilters", message: "Не вдалося застосувати фільтри за тегами профілю." };
      }
      const ids = [
        ...new Set(
          (tagRows ?? []).map((r) => r.profile_id).filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      ];
      creatorIdRestriction = intersectIdList(creatorIdRestriction, ids);
      if (creatorIdRestriction.length === 0) {
        return { ok: true, listings: [], total: 0 };
      }
    }
  }

  const interestIds = filters.authorInterestTagIds ?? [];
  if (interestIds.length > 0) {
    const matchedCreators = await fetchCreatorIdsMatchingAuthorInterests(supabase, interestIds);
    creatorIdRestriction = intersectIdList(creatorIdRestriction, matchedCreators);
    if (creatorIdRestriction.length === 0) {
      return { ok: true, listings: [], total: 0 };
    }
  }

  let query = supabase
    .from("listings")
    .select(LISTING_DETAILS_SELECT, { count: "exact" })
    .eq("is_active", true);

  if (filters.type) {
    query = query.eq("type", filters.type);
  } else if (filters.types && filters.types.length > 0) {
    query = query.in("type", filters.types);
  }
  if (filters.cityId) {
    query = query.eq("city_id", filters.cityId);
  } else if (filters.cityIds && filters.cityIds.length > 0) {
    query = query.in("city_id", filters.cityIds);
  }
  if (typeof filters.priceMin === "number") {
    query = query.gte("price", filters.priceMin);
  }
  if (typeof filters.priceMax === "number") {
    query = query.lte("price", filters.priceMax);
  }

  for (const blockedId of blockedIds) {
    query = query.neq("creator_id", blockedId);
  }

  query = query.neq("creator_id", user.id);

  if (creatorIdRestriction) {
    query = query.in("creator_id", creatorIdRestriction);
  }

  const { data: listingRows, error: listingsError, count } = await query
    .order("updated_at", { ascending: false })
    .range(0, 49);

  if (listingsError) {
    return { ok: false, reason: "invalidFilters", message: "Не вдалося завантажити оголошення. Спробуйте ще раз." };
  }

  const rows = listingRows ?? [];
  const seekerCtx = await loadSeekerBatchContext(
    supabase,
    user.id,
    rows.map((r) => (r as ListingDetailsQueryRow).id),
  );

  const listings: ListingCardModel[] = rows.map((listingRow) => {
    const row = listingRow as ListingDetailsQueryRow;
    const detailsBase = buildListingDetailsPayload(row, {
      supabase,
      reviewSummary: null,
    });
    return applySeekerToListingCard(row, detailsBase, seekerCtx);
  });

  return {
    ok: true,
    listings,
    total: typeof count === "number" ? count : listings.length,
  };
}

export async function getPublicListingFreshDataAction(
  listingId: string,
  options?: { scope?: PublicListingFreshDataScope },
): Promise<MyListingFreshDataActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const scope = options?.scope ?? "discovery";
  const trimmedId = listingId.trim();

  const [{ data: outgoingBlocks }, { data: incomingBlocks }, { data: listingRow, error: listingError }] =
    await Promise.all([
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
      supabase.from("user_blocks").select("blocker_id").eq("blocked_id", user.id),
      supabase.from("listings").select(LISTING_DETAILS_SELECT).eq("id", trimmedId).eq("is_active", true).maybeSingle(),
    ]);

  if (listingError || !listingRow) {
    return { ok: false, reason: "notFound" };
  }

  const row = listingRow as ListingDetailsQueryRow;

  if (scope === "discovery") {
    const blockedIds = new Set(
      [
        ...(outgoingBlocks ?? []).map((b) => b.blocked_id),
        ...(incomingBlocks ?? []).map((b) => b.blocker_id),
      ].filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    if (blockedIds.has(row.creator_id)) {
      return { ok: false, reason: "notFound" };
    }
  }

  let reviewSummary: ListingDetailsReviewSummary | null = null;
  if (row.creator_id === user.id) {
    const { data: reviewRatings } = await supabase.from("reviews").select("rating").eq("target_id", user.id);
    const ratings = (reviewRatings ?? []).map((r) => r.rating).filter((n) => typeof n === "number");
    if (ratings.length > 0) {
      const avg5 = ratings.reduce((acc, n) => acc + n, 0) / ratings.length;
      reviewSummary = {
        averageOutOf10: avg5 * 2,
        count: ratings.length,
      };
    }
  }

  const detailsBase = buildListingDetailsPayload(row, {
    supabase,
    reviewSummary,
  });

  const seekerCtx = await loadSeekerBatchContext(supabase, user.id, [row.id]);
  const card = applySeekerToListingCard(row, detailsBase, seekerCtx);

  return {
    ok: true,
    details: card.details,
    card,
  };
}

export async function getMyRequestsAction(): Promise<MyRequestsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const { data: requestRows, error: reqError } = await supabase
    .from("listing_requests")
    .select("listing_id")
    .eq("initiator_id", user.id);

  if (reqError) {
    return { ok: false, reason: "unknown", message: "Не вдалося завантажити заявки." };
  }

  const listingIds = [
    ...new Set(
      (requestRows ?? [])
        .map((r) => r.listing_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  if (listingIds.length === 0) {
    return { ok: true, listings: [] };
  }

  const { data: listingRows, error: listError } = await supabase
    .from("listings")
    .select(LISTING_DETAILS_SELECT)
    .in("id", listingIds);

  if (listError || !listingRows?.length) {
    return { ok: false, reason: "unknown", message: "Не вдалося завантажити оголошення." };
  }

  const seekerCtx = await loadSeekerBatchContext(
    supabase,
    user.id,
    listingRows.map((r) => (r as ListingDetailsQueryRow).id),
  );

  const listings: ListingCardModel[] = listingRows.map((listingRow) => {
    const row = listingRow as ListingDetailsQueryRow;
    const detailsBase = buildListingDetailsPayload(row, {
      supabase,
      reviewSummary: null,
    });
    return applySeekerToListingCard(row, detailsBase, seekerCtx);
  });

  listings.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return { ok: true, listings };
}

export async function getIncomingRequestsAction(listingId: string): Promise<GetIncomingRequestsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated", message: "Сесія завершилася. Увійдіть знову." };
  }

  const trimmed = listingId.trim();
  const { data: listing, error: listErr } = await supabase
    .from("listings")
    .select("id, title, updated_at")
    .eq("id", trimmed)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (listErr || !listing || typeof listing.title !== "string" || typeof listing.updated_at !== "string") {
    return {
      ok: false,
      reason: "forbidden",
      message: "Оголошення недоступне або ви не є його автором.",
    };
  }

  const { data: reqRows, error: reqErr } = await supabase
    .from("listing_requests")
    .select("id, initiator_id, status, updated_at, similarity_score")
    .eq("listing_id", trimmed);

  if (reqErr) {
    return { ok: false, reason: "unknown", message: "Не вдалося завантажити заявки." };
  }

  const rows = reqRows ?? [];
  if (rows.length === 0) {
    return {
      ok: true,
      listingTitle: listing.title,
      listingUpdatedAt: listing.updated_at,
      requests: [],
    };
  }

  const initiatorIds = [
    ...new Set(
      rows
        .map((r) => (typeof r.initiator_id === "string" ? r.initiator_id : ""))
        .filter((id) => id.length > 0),
    ),
  ];

  const [profilesRes, myBlocksRes, blockedMeRes] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, avatar_path").in("id", initiatorIds),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
    supabase.from("user_blocks").select("blocker_id").eq("blocked_id", user.id),
  ]);

  if (profilesRes.error) {
    return { ok: false, reason: "unknown", message: "Не вдалося завантажити профілі заявників." };
  }

  const profileById = new Map<
    string,
    { first_name: string | null; last_name: string | null; avatar_path: string | null }
  >();
  for (const p of profilesRes.data ?? []) {
    if (typeof p.id === "string") {
      profileById.set(p.id, {
        first_name: typeof p.first_name === "string" ? p.first_name : null,
        last_name: typeof p.last_name === "string" ? p.last_name : null,
        avatar_path: typeof p.avatar_path === "string" && p.avatar_path.length > 0 ? p.avatar_path : null,
      });
    }
  }

  const profileImageBucket = supabase.storage.from("profile-images");

  const iBlockedSeekerIds = new Set(
    (myBlocksRes.data ?? [])
      .map((r) => r.blocked_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const seekerIdsWhoBlockedMe = new Set(
    (blockedMeRes.data ?? [])
      .map((r) => r.blocker_id)
      .filter((id): id is string => typeof id === "string"),
  );

  const requests: OwnerIncomingRequestItem[] = [];
  for (const r of rows) {
    const requestId = typeof r.id === "string" ? r.id : "";
    const seekerId = typeof r.initiator_id === "string" ? r.initiator_id : "";
    const st = r.status;
    const updatedAt = typeof r.updated_at === "string" ? r.updated_at : "";
    if (!requestId || !seekerId || !updatedAt) {
      continue;
    }
    if (st !== "pending" && st !== "accepted" && st !== "rejected") {
      continue;
    }

    const seekerBlockedMe = seekerIdsWhoBlockedMe.has(seekerId);
    const iBlockedSeeker = iBlockedSeekerIds.has(seekerId);
    if (seekerBlockedMe && !iBlockedSeeker) {
      continue;
    }

    const prof = profileById.get(seekerId);
    const seekerFirstName = prof?.first_name?.trim() || "Користувач";
    const lastRaw = typeof prof?.last_name === "string" ? prof.last_name.trim() : "";
    const seekerLastName = lastRaw.length > 0 ? lastRaw : null;
    const seekerAvatarUrl =
      prof?.avatar_path != null
        ? profileImageBucket.getPublicUrl(prof.avatar_path).data.publicUrl
        : null;

    const rawScore = r.similarity_score;
    const rounded = rawScore != null && rawScore !== "" ? Math.round(Number(rawScore)) : null;
    const similarityScore = rounded != null && Number.isFinite(rounded) ? rounded : null;

    requests.push({
      requestId,
      seekerId,
      status: st,
      requestUpdatedAt: updatedAt,
      similarityScore,
      seekerFirstName,
      seekerLastName,
      seekerAvatarUrl,
      iBlockedSeeker,
    });
  }

  requests.sort((a, b) => (a.requestUpdatedAt < b.requestUpdatedAt ? 1 : -1));

  return {
    ok: true,
    listingTitle: listing.title,
    listingUpdatedAt: listing.updated_at,
    requests,
  };
}

export async function createListingRequestAction(
  listingId: string,
  expectedListingUpdatedAt: string,
): Promise<SimpleListingMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Увійдіть, щоб подати заявку." };
  }

  const trimmed = listingId.trim();
  const { data: listing } = await supabase
    .from("listings")
    .select("creator_id, updated_at")
    .eq("id", trimmed)
    .eq("is_active", true)
    .maybeSingle();

  if (!listing || listing.creator_id === user.id) {
    return { ok: false, message: "Оголошення недоступне. Оновіть сторінку." };
  }

  if (listing.updated_at !== expectedListingUpdatedAt) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const creatorId = listing.creator_id as string;
  const peerGate = await gateListingPeerInteraction(supabase, user.id, creatorId);
  if (!peerGate.ok) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { error } = await supabase.from("listing_requests").insert({
    listing_id: trimmed,
    initiator_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Заявку вже подано." };
    }
    return { ok: false, message: "Не вдалося подати заявку. Спробуйте ще раз." };
  }

  revalidatePath("/listings");
  revalidatePath("/my-requests");
  revalidatePath("/my-listings");
  revalidatePath(`/my-listings/${trimmed}/requests`);
  return { ok: true };
}

export async function cancelListingRequestAction(
  listingId: string,
  expectedRequestUpdatedAt: string,
): Promise<SimpleListingMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Увійдіть знову." };
  }

  const trimmed = listingId.trim();
  const expectedReq =
    typeof expectedRequestUpdatedAt === "string" ? expectedRequestUpdatedAt.trim() : "";
  if (!expectedReq) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const { data: listingForGate } = await supabase
    .from("listings")
    .select("creator_id")
    .eq("id", trimmed)
    .maybeSingle();

  if (!listingForGate || typeof listingForGate.creator_id !== "string") {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const cancelGate = await gateListingPeerInteraction(supabase, user.id, listingForGate.creator_id);
  if (!cancelGate.ok) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { data: pendingRow } = await supabase
    .from("listing_requests")
    .select("id")
    .eq("listing_id", trimmed)
    .eq("initiator_id", user.id)
    .eq("status", "pending")
    .eq("updated_at", expectedReq)
    .maybeSingle();

  if (!pendingRow || typeof pendingRow.id !== "string") {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const { data: deletedRows, error } = await supabase
    .from("listing_requests")
    .delete()
    .eq("id", pendingRow.id)
    .eq("listing_id", trimmed)
    .eq("initiator_id", user.id)
    .eq("status", "pending")
    .eq("updated_at", expectedReq)
    .select("id");

  if (error) {
    return { ok: false, message: "Не вдалося скасувати заявку. Спробуйте ще раз." };
  }
  if (!deletedRows?.length) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  revalidatePath("/listings");
  revalidatePath("/my-requests");
  revalidatePath("/my-listings");
  revalidatePath(`/my-listings/${trimmed}/requests`);
  return { ok: true };
}

export async function blockListingAuthorAction(
  listingId: string,
  expectedListingUpdatedAt: string,
  expectedRequestUpdatedAt?: string | null,
): Promise<SimpleListingMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Увійдіть знову." };
  }

  const trimmed = listingId.trim();
  const { data: listing } = await supabase
    .from("listings")
    .select("creator_id, updated_at")
    .eq("id", trimmed)
    .maybeSingle();

  if (!listing || listing.creator_id === user.id) {
    return { ok: false, message: "Оголошення недоступне. Оновіть сторінку." };
  }

  if (listing.updated_at !== expectedListingUpdatedAt) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const requestFresh = await assertSeekerRequestUpdatedAtMatches(
    supabase,
    user.id,
    trimmed,
    expectedRequestUpdatedAt,
  );
  if (!requestFresh) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const blockGate = await gateListingPeerInteraction(supabase, user.id, listing.creator_id as string);
  if (!blockGate.ok) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: user.id,
    blocked_id: listing.creator_id,
  });

  if (error) {
    if (error.code === "23505") {
      revalidatePath("/listings");
      revalidatePath("/my-requests");
      return { ok: true };
    }
    return { ok: false, message: "Не вдалося заблокувати користувача. Спробуйте ще раз." };
  }

  revalidatePath("/listings");
  revalidatePath("/my-requests");
  return { ok: true };
}

export async function unblockListingAuthorAction(
  listingId: string,
  expectedListingUpdatedAt: string,
  expectedRequestUpdatedAt?: string | null,
): Promise<SimpleListingMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Увійдіть знову." };
  }

  const trimmed = listingId.trim();
  const { data: listing } = await supabase
    .from("listings")
    .select("creator_id, updated_at")
    .eq("id", trimmed)
    .maybeSingle();

  if (!listing) {
    return { ok: false, message: "Оголошення недоступне. Оновіть сторінку." };
  }

  if (listing.updated_at !== expectedListingUpdatedAt) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const requestFresh = await assertSeekerRequestUpdatedAtMatches(
    supabase,
    user.id,
    trimmed,
    expectedRequestUpdatedAt,
  );
  if (!requestFresh) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const unblockGate = await gateUnblockListingAuthorPeer(supabase, user.id, listing.creator_id as string);
  if (!unblockGate.ok) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { data: deletedBlocks, error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", listing.creator_id)
    .select("blocker_id");

  if (error) {
    return { ok: false, message: "Не вдалося розблокувати користувача. Спробуйте ще раз." };
  }
  if (!deletedBlocks?.length) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  revalidatePath("/listings");
  revalidatePath("/my-requests");
  return { ok: true };
}

export async function getAcceptedContactsAction(
  listingId: string,
  expectedRequestUpdatedAt: string,
): Promise<AcceptedContactsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const trimmed = listingId.trim();
  const { data: listing } = await supabase.from("listings").select("creator_id").eq("id", trimmed).maybeSingle();

  if (!listing) {
    return { ok: false, reason: "forbidden", message: "Оголошення недоступне. Оновіть сторінку." };
  }

  const { data: acceptedRow } = await supabase
    .from("listing_requests")
    .select("id")
    .eq("listing_id", trimmed)
    .eq("initiator_id", user.id)
    .eq("status", "accepted")
    .eq("updated_at", expectedRequestUpdatedAt)
    .maybeSingle();

  if (!acceptedRow) {
    return { ok: false, reason: "forbidden", message: STALE_SEEKER_STATE_MESSAGE };
  }

  const contactsGate = await gateListingPeerInteraction(supabase, user.id, listing.creator_id as string);
  if (!contactsGate.ok) {
    return { ok: false, reason: "forbidden", message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { data: rpcData, error } = await supabase.rpc("get_accepted_contacts", {
    p_target_id: listing.creator_id,
    p_listing_id: trimmed,
  });

  if (error) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Немає доступу до контактів для цього оголошення.",
    };
  }

  type RpcRow = { phone?: string | null; telegram?: string | null; email?: string | null };
  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as RpcRow | undefined;

  return {
    ok: true,
    phone: row?.phone ?? null,
    telegram: row?.telegram ?? null,
    email: row?.email ?? null,
  };
}

export async function getOwnerSeekerContactsAction(
  listingId: string,
  seekerId: string,
  expectedRequestUpdatedAt: string,
): Promise<AcceptedContactsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const trimmedListing = listingId.trim();
  const trimmedSeeker = seekerId.trim();
  const expectedReq =
    typeof expectedRequestUpdatedAt === "string" ? expectedRequestUpdatedAt.trim() : "";
  if (!trimmedListing || !trimmedSeeker || !expectedReq) {
    return { ok: false, reason: "forbidden", message: STALE_SEEKER_STATE_MESSAGE };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("creator_id")
    .eq("id", trimmedListing)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!listing) {
    return { ok: false, reason: "forbidden", message: "Оголошення недоступне. Оновіть сторінку." };
  }

  const { data: acceptedRow } = await supabase
    .from("listing_requests")
    .select("id")
    .eq("listing_id", trimmedListing)
    .eq("initiator_id", trimmedSeeker)
    .eq("status", "accepted")
    .eq("updated_at", expectedReq)
    .maybeSingle();

  if (!acceptedRow) {
    return { ok: false, reason: "forbidden", message: STALE_SEEKER_STATE_MESSAGE };
  }

  const contactsGate = await gateListingPeerInteraction(supabase, user.id, trimmedSeeker, "strict");
  if (!contactsGate.ok) {
    return { ok: false, reason: "forbidden", message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { data: rpcData, error } = await supabase.rpc("get_accepted_contacts", {
    p_target_id: trimmedSeeker,
    p_listing_id: trimmedListing,
  });

  if (error) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Немає доступу до контактів для цієї заявки.",
    };
  }

  type RpcRow = { phone?: string | null; telegram?: string | null; email?: string | null };
  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as RpcRow | undefined;

  return {
    ok: true,
    phone: row?.phone ?? null,
    telegram: row?.telegram ?? null,
    email: row?.email ?? null,
  };
}

async function gateOwnerUnblockSeekerPeer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  seekerId: string,
): Promise<{ ok: true } | { ok: false }> {
  const [{ data: seekerProfile }, { data: ownerProfile }] = await Promise.all([
    supabase.from("profiles").select("is_blocked").eq("id", seekerId).maybeSingle(),
    supabase.from("profiles").select("is_blocked").eq("id", ownerId).maybeSingle(),
  ]);

  if (ownerProfile?.is_blocked === true || seekerProfile?.is_blocked === true) {
    return { ok: false };
  }

  return { ok: true };
}

export async function blockListingSeekerAction(
  listingId: string,
  seekerId: string,
  expectedListingUpdatedAt: string,
  expectedRequestUpdatedAt?: string | null,
): Promise<SimpleListingMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Увійдіть знову." };
  }

  const trimmedListing = listingId.trim();
  const trimmedSeeker = seekerId.trim();
  if (!trimmedListing || !trimmedSeeker) {
    return { ok: false, message: "Оголошення недоступне. Оновіть сторінку." };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("creator_id, updated_at")
    .eq("id", trimmedListing)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!listing || listing.creator_id !== user.id) {
    return { ok: false, message: "Оголошення недоступне. Оновіть сторінку." };
  }

  if (listing.updated_at !== expectedListingUpdatedAt) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const expectedReqRaw =
    typeof expectedRequestUpdatedAt === "string" ? expectedRequestUpdatedAt.trim() : "";
  if (!expectedReqRaw) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const { data: requestRow } = await supabase
    .from("listing_requests")
    .select("id")
    .eq("listing_id", trimmedListing)
    .eq("initiator_id", trimmedSeeker)
    .maybeSingle();

  if (!requestRow || typeof requestRow.id !== "string") {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const requestFresh = await assertOwnerListingRequestUpdatedAtMatches(
    supabase,
    trimmedListing,
    requestRow.id,
    trimmedSeeker,
    expectedReqRaw,
  );
  if (!requestFresh) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const blockGate = await gateListingPeerInteraction(supabase, user.id, trimmedSeeker, "strict");
  if (!blockGate.ok) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: user.id,
    blocked_id: trimmedSeeker,
  });

  if (error) {
    if (error.code === "23505") {
      revalidatePath("/my-listings");
      revalidatePath(`/my-listings/${trimmedListing}/requests`);
      return { ok: true };
    }
    return { ok: false, message: "Не вдалося заблокувати користувача. Спробуйте ще раз." };
  }

  revalidatePath("/my-listings");
  revalidatePath(`/my-listings/${trimmedListing}/requests`);
  return { ok: true };
}

export async function unblockListingSeekerAction(
  listingId: string,
  seekerId: string,
  expectedListingUpdatedAt: string,
  expectedRequestUpdatedAt?: string | null,
): Promise<SimpleListingMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Увійдіть знову." };
  }

  const trimmedListing = listingId.trim();
  const trimmedSeeker = seekerId.trim();
  if (!trimmedListing || !trimmedSeeker) {
    return { ok: false, message: "Оголошення недоступне. Оновіть сторінку." };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("creator_id, updated_at")
    .eq("id", trimmedListing)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!listing) {
    return { ok: false, message: "Оголошення недоступне. Оновіть сторінку." };
  }

  if (listing.updated_at !== expectedListingUpdatedAt) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const expectedReqRaw =
    typeof expectedRequestUpdatedAt === "string" ? expectedRequestUpdatedAt.trim() : "";
  if (!expectedReqRaw) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const { data: requestRow } = await supabase
    .from("listing_requests")
    .select("id")
    .eq("listing_id", trimmedListing)
    .eq("initiator_id", trimmedSeeker)
    .maybeSingle();

  if (!requestRow || typeof requestRow.id !== "string") {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const requestFresh = await assertOwnerListingRequestUpdatedAtMatches(
    supabase,
    trimmedListing,
    requestRow.id,
    trimmedSeeker,
    expectedReqRaw,
  );
  if (!requestFresh) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const unblockGate = await gateOwnerUnblockSeekerPeer(supabase, user.id, trimmedSeeker);
  if (!unblockGate.ok) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { data: deletedBlocks, error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", trimmedSeeker)
    .select("blocker_id");

  if (error) {
    return { ok: false, message: "Не вдалося розблокувати користувача. Спробуйте ще раз." };
  }
  if (!deletedBlocks?.length) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  revalidatePath("/my-listings");
  revalidatePath(`/my-listings/${trimmedListing}/requests`);
  return { ok: true };
}

export async function updateMyListingStatusAction(
  listingId: string,
  isActive: boolean,
  expectedUpdatedAt: string,
): Promise<UpdateMyListingStatusActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Оновіть сторінку та увійдіть повторно." };
  }

  const { data: listingRow, error: listingError } = await supabase
    .from("listings")
    .select("id, updated_at")
    .eq("id", listingId)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (listingError) {
    return { ok: false, message: "Не вдалося перевірити стан оголошення. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!listingRow) {
    return { ok: false, message: "Оголошення більше недоступне. Оновіть сторінку та спробуйте ще раз." };
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("listings")
    .update({ is_active: isActive })
    .eq("id", listingId)
    .eq("creator_id", user.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");

  if (updateError) {
    return { ok: false, message: "Не вдалося змінити статус оголошення. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!updatedRows?.length) {
    return { ok: false, message: "Дані застаріли. Оновіть сторінку та спробуйте ще раз." };
  }

  revalidatePath("/my-listings");
  return { ok: true, isActive, updatedAt: updatedRows[0].updated_at };
}

export async function deleteMyListingAction(
  listingId: string,
  expectedUpdatedAt: string,
): Promise<DeleteMyListingActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Оновіть сторінку та увійдіть повторно." };
  }

  const { data: listingRow, error: listingError } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (listingError) {
    return { ok: false, message: "Не вдалося перевірити стан оголошення. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!listingRow) {
    return { ok: false, message: "Оголошення більше недоступне. Оновіть сторінку та спробуйте ще раз." };
  }

  const { data: imageRows, error: imagesError } = await supabase
    .from("listing_images")
    .select("image_path")
    .eq("listing_id", listingId);

  if (imagesError) {
    return { ok: false, message: "Не вдалося підготувати видалення. Оновіть сторінку та спробуйте ще раз." };
  }

  const imagePaths = (imageRows ?? [])
    .map((row) => row.image_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);

  const { data: deletedRows, error: deleteError } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("creator_id", user.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");

  if (deleteError) {
    return { ok: false, message: "Не вдалося видалити оголошення. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!deletedRows?.length) {
    return { ok: false, message: "Дані застаріли. Оновіть сторінку та спробуйте ще раз." };
  }

  if (imagePaths.length > 0) {
    await supabase.storage.from("listing-images").remove(imagePaths);
  }

  revalidatePath("/my-listings");
  return { ok: true };
}

export async function ownerRespondToListingRequestAction(
  listingId: string,
  requestId: string,
  decision: "accepted" | "rejected" | "pending",
  expectedRequestUpdatedAt: string,
): Promise<OwnerRespondToListingRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Сесія завершилася. Оновіть сторінку та увійдіть повторно." };
  }

  const trimmedListingId = listingId.trim();
  const trimmedRequestId = requestId.trim();
  const expectedReq =
    typeof expectedRequestUpdatedAt === "string" ? expectedRequestUpdatedAt.trim() : "";

  if (!trimmedListingId || !trimmedRequestId || !expectedReq) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const { data: listingRow, error: listingError } = await supabase
    .from("listings")
    .select("id")
    .eq("id", trimmedListingId)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (listingError || !listingRow) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { data: reqRow, error: reqError } = await supabase
    .from("listing_requests")
    .select("initiator_id, status, updated_at")
    .eq("id", trimmedRequestId)
    .eq("listing_id", trimmedListingId)
    .maybeSingle();

  if (reqError || !reqRow || typeof reqRow.initiator_id !== "string") {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  if (reqRow.updated_at !== expectedReq) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const st = reqRow.status;
  if (st !== "pending" && st !== "accepted" && st !== "rejected") {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const transitionOk =
    (decision === "accepted" && (st === "pending" || st === "rejected")) ||
    (decision === "rejected" && (st === "pending" || st === "accepted")) ||
    (decision === "pending" && st === "rejected");
  if (!transitionOk) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  const ownerGate = await gateListingPeerInteraction(supabase, user.id, reqRow.initiator_id, "strict");
  if (!ownerGate.ok) {
    return { ok: false, message: LISTING_PEER_BLOCKED_MESSAGE };
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("listing_requests")
    .update({ status: decision })
    .eq("id", trimmedRequestId)
    .eq("listing_id", trimmedListingId)
    .eq("updated_at", expectedReq)
    .eq("status", st)
    .select("id");

  if (updateError) {
    return { ok: false, message: "Не вдалося оновити заявку. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!updatedRows?.length) {
    return { ok: false, message: STALE_SEEKER_STATE_MESSAGE };
  }

  revalidatePath("/my-listings");
  revalidatePath(`/my-listings/${trimmedListingId}/requests`);
  revalidatePath("/listings");
  return { ok: true };
}
