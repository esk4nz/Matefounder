"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";

import { createReportPayloadSchema } from "@/app/schemas/reports";
import { createClient } from "@/lib/supabase/server";

export type CreateReportResult = { ok: true } | { ok: false; error: string };

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

const DUPLICATE_OPEN_REPORT_MESSAGE =
  "Ви вже надіслали скаргу на цей об'єкт. Вона очікує на розгляд модераторами.";

export async function createReportAction(payload: unknown): Promise<CreateReportResult> {
  const parsed = createReportPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: humanZodMessage(parsed.error.issues[0]?.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Увійдіть, щоб надіслати скаргу." };
  }

  if (parsed.data.targetUserId === user.id) {
    return { ok: false, error: "Не можна надіслати скаргу на власний профіль." };
  }

  let dupQuery = supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("target_user_id", parsed.data.targetUserId)
    .eq("status", "open")
    .limit(1);

  if (parsed.data.targetReviewId != null) {
    dupQuery = dupQuery.eq("target_review_id", parsed.data.targetReviewId);
  } else {
    dupQuery = dupQuery.is("target_review_id", null);
  }

  if (parsed.data.targetListingId != null) {
    dupQuery = dupQuery.eq("target_listing_id", parsed.data.targetListingId);
  } else {
    dupQuery = dupQuery.is("target_listing_id", null);
  }

  const { data: duplicateRows, error: dupError } = await dupQuery;

  if (dupError) {
    return { ok: false, error: mapSupabaseError(dupError.message) };
  }
  if (duplicateRows != null && duplicateRows.length > 0) {
    return { ok: false, error: DUPLICATE_OPEN_REPORT_MESSAGE };
  }

  const row: Record<string, unknown> = {
    reporter_id: user.id,
    target_user_id: parsed.data.targetUserId,
    reason: parsed.data.reason,
  };
  if (parsed.data.targetReviewId != null) {
    row.target_review_id = parsed.data.targetReviewId;
  }
  if (parsed.data.targetListingId != null) {
    row.target_listing_id = parsed.data.targetListingId;
  }

  const { error } = await supabase.from("reports").insert(row);

  if (error) {
    if (isRowLevelSecurityViolation(error)) {
      return { ok: false, error: "Немає прав надіслати скаргу за цими даними." };
    }
    return { ok: false, error: mapSupabaseError(error.message) };
  }

  await supabase.from("user_blocks").insert({
    blocker_id: user.id,
    blocked_id: parsed.data.targetUserId,
  });

  revalidatePath("/listings");
  revalidatePath(`/profile/${parsed.data.targetUserId}/reviews`, "page");

  return { ok: true };
}
