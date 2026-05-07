"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PROFILE_EXCLUSIVE_CATEGORIES,
  type ProfileExclusiveTagCategory,
} from "@/app/schemas/profile";
import { createListingFormSchema } from "../schemas/listings";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { buildListingDetailsPayload, type ListingDetailsQueryRow } from "@/lib/listings/build-listing-details-payload";
import { LISTING_MAX_PHOTOS } from "@/lib/listings/constants";
import type { ListingDetailsPayload, ListingDetailsReviewSummary } from "@/lib/listings/listing-details-types";
import { createClient } from "@/lib/supabase/server";

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
      card: {
        id: string;
        title: string;
        type: "offering" | "searching";
        isActive: boolean;
        updatedAt: string;
        firstImageUrl: string | null;
        details: ListingDetailsPayload;
      };
    };

export type UpdateMyListingStatusActionResult =
  | { ok: false; message: string }
  | { ok: true; isActive: boolean; updatedAt: string };

export type DeleteMyListingActionResult =
  | { ok: false; message: string }
  | { ok: true };

const LISTING_DETAILS_SELECT = `
  id,
  title,
  type,
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
    profile_tags(tags(id, slug, label_uk, category_id, tag_categories(name)))
  )
`;

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

  const selectedTagIds = new Set((selectedTagRows ?? []).map((row) => row.tag_id));

  const selectedRequiredCategories = new Set<string>();
  for (const row of allTagRows) {
    if (!selectedTagIds.has(row.id)) {
      continue;
    }
    if (row.category !== "interests") {
      selectedRequiredCategories.add(row.category);
    }
  }

  const hasAllRequiredTagCategories = PROFILE_EXCLUSIVE_CATEGORIES.every((category) =>
    selectedRequiredCategories.has(category),
  );

  const missingFields: string[] = [];
  if (!profile.first_name?.trim()) {
    missingFields.push("ім'я");
  }
  if (!profile.last_name?.trim()) {
    missingFields.push("прізвище");
  }
  if (!profile.contact_phone?.trim()) {
    missingFields.push("номер телефону");
  }
  if (!hasAllRequiredTagCategories) {
    missingFields.push("обов'язкові теги профілю");
  }

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
      firstImageUrl: details.imageUrls[0] ?? null,
      details,
    },
  };
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
