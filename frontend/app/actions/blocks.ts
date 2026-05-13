"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";

import { reviewTargetIdSchema } from "@/app/schemas/reviews";
import { createClient } from "@/lib/supabase/server";

export type BlockMutationResult = { ok: true } | { ok: false; error: string };

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

function isNoSelfViolation(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }
  const blob = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return blob.includes("user_blocks_no_self");
}

function revalidateBlockRelatedPaths(targetUserId: string) {
  revalidatePath(`/profile/${targetUserId}/reviews`);
  revalidatePath("/listings");
}

export async function blockUserAction(targetUserId: string): Promise<BlockMutationResult> {
  const idParse = reviewTargetIdSchema.safeParse(targetUserId);
  if (!idParse.success) {
    return { ok: false, error: idParse.error.issues[0]?.message ?? "Некоректний профіль." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Увійдіть, щоб заблокувати користувача." };
  }

  if (targetUserId === user.id) {
    return { ok: false, error: "Не можна заблокувати власний профіль." };
  }

  const { data: existingBlock, error: selectError } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetUserId)
    .maybeSingle();

  if (selectError) {
    return { ok: false, error: mapSupabaseError(selectError.message) };
  }
  if (existingBlock) {
    return {
      ok: false,
      error: "Ви вже заблокували цього користувача. Оновіть сторінку.",
    };
  }

  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: user.id,
    blocked_id: targetUserId,
  });

  if (error) {
    if (isNoSelfViolation(error)) {
      return { ok: false, error: "Не можна заблокувати власний профіль." };
    }
    return { ok: false, error: mapSupabaseError(error.message) };
  }

  revalidateBlockRelatedPaths(targetUserId);
  return { ok: true };
}

export async function unblockUserAction(targetUserId: string): Promise<BlockMutationResult> {
  const idParse = reviewTargetIdSchema.safeParse(targetUserId);
  if (!idParse.success) {
    return { ok: false, error: idParse.error.issues[0]?.message ?? "Некоректний профіль." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Увійдіть, щоб розблокувати користувача." };
  }

  const { error, count } = await supabase
    .from("user_blocks")
    .delete({ count: "exact" })
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetUserId);

  if (error) {
    return { ok: false, error: mapSupabaseError(error.message) };
  }

  if (typeof count === "number" && count === 0) {
    return {
      ok: false,
      error: "Користувач вже розблокований. Оновіть сторінку.",
    };
  }

  revalidateBlockRelatedPaths(targetUserId);
  return { ok: true };
}

export async function checkBlockStatusAction(targetUserId: string): Promise<boolean> {
  const idParse = reviewTargetIdSchema.safeParse(targetUserId);
  if (!idParse.success) {
    return false;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetUserId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}
