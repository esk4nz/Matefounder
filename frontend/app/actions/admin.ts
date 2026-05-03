"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

export type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  isBlocked: boolean;
  isAdmin: boolean;
  updatedAt: string;
};

type RpcUserRow = {
  id: string;
  username: string;
  avatar_path: string | null;
  is_blocked: boolean;
  is_admin: boolean;
  email: string;
  updated_at: string;
};

const STALE_USER_STATUS_MESSAGE =
  "Статус користувача змінився. Оновіть список і спробуйте ще раз.";

const ADMIN_LIST_PAGE_SIZE = 15;

export async function listAdminUsersAction(
  query: string | undefined,
  options?: { offset?: number },
): Promise<
  { ok: true; users: AdminUserRow[]; hasMore: boolean } | { ok: false; message: string }
> {
  await requireAdminOrRedirect();

  const supabase = await createClient();
  const trimmed = query?.trim() ?? "";
  const offset = Math.max(0, options?.offset ?? 0);
  const fetchLimit = ADMIN_LIST_PAGE_SIZE + 1;

  const { data: rows, error } = await supabase.rpc("admin_console_list_users", {
    p_search: trimmed.length > 0 ? trimmed : null,
    p_limit: fetchLimit,
    p_offset: offset,
  });

  if (error) {
    return { ok: false, message: "Не вдалося завантажити список користувачів." };
  }

  const raw = (rows as RpcUserRow[] | null | undefined) ?? [];
  const hasMore = raw.length > ADMIN_LIST_PAGE_SIZE;
  const pageRows = hasMore ? raw.slice(0, ADMIN_LIST_PAGE_SIZE) : raw;

  const service = createServiceRoleClient();
  const users: AdminUserRow[] = pageRows.map((p) => ({
    id: p.id,
    username: p.username,
    email: p.email ?? "",
    avatarUrl: p.avatar_path
      ? service.storage.from("profile-images").getPublicUrl(p.avatar_path).data
          .publicUrl
      : null,
    isBlocked: p.is_blocked,
    isAdmin: p.is_admin,
    updatedAt: p.updated_at,
  }));

  return { ok: true, users, hasMore };
}

export async function setUserBlockedAction(
  targetUserId: string,
  blocked: boolean,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId } = await requireAdminOrRedirect();

  if (targetUserId === userId) {
    return {
      ok: false,
      message: "Неможливо змінити блокування для власного облікового запису.",
    };
  }

  const admin = createServiceRoleClient();
  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", targetUserId)
    .maybeSingle();

  if (readError || !target) {
    return { ok: false, message: "Користувача не знайдено." };
  }
  if (target.is_admin) {
    return {
      ok: false,
      message: "Неможливо змінювати блокування іншого адміністратора.",
    };
  }

  const { data: updated, error } = await admin
    .from("profiles")
    .update({ is_blocked: blocked })
    .eq("id", targetUserId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");

  if (error) {
    return { ok: false, message: "Не вдалося оновити статус блокування." };
  }
  if (!updated?.length) {
    return { ok: false, message: STALE_USER_STATUS_MESSAGE };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function grantAdminRoleAction(
  targetUserId: string,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId } = await requireAdminOrRedirect();

  if (targetUserId === userId) {
    return { ok: false, message: "Ця дія недоступна для власного облікового запису." };
  }

  const admin = createServiceRoleClient();
  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", targetUserId)
    .maybeSingle();

  if (readError || !target) {
    return { ok: false, message: "Користувача не знайдено." };
  }
  if (target.is_admin) {
    return { ok: false, message: STALE_USER_STATUS_MESSAGE };
  }

  const { data: updated, error } = await admin
    .from("profiles")
    .update({ is_admin: true, is_blocked: false })
    .eq("id", targetUserId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");

  if (error) {
    return { ok: false, message: "Не вдалося надати права адміністратора." };
  }
  if (!updated?.length) {
    return { ok: false, message: STALE_USER_STATUS_MESSAGE };
  }
  revalidatePath("/admin");
  return { ok: true };
}
