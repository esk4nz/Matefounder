"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildInterestSlugFromLabel,
  normalizeManualInterestSlug,
} from "@/lib/admin/interest-tag-slug";
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

const INTERESTS_CATEGORY_NAME = "Інтереси";
const DUPLICATE_INTEREST_LABEL_MESSAGE = "Такий інтерес вже існує";
const STALE_INTEREST_TAG_MESSAGE = "Дані застаріли, оновіть сторінку.";
const INTEREST_TAG_NOT_FOUND_MESSAGE =
  "Даний інтерес не знайдено. Оновіть сторінку.";
const INTEREST_SLUG_TAKEN_MESSAGE =
  "Такий технічний ідентифікатор (slug) уже використовується.";

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

export type AdminInterestTagRow = {
  id: number;
  labelUk: string;
  slug: string;
  updatedAt: string;
};

function tagsRowsEqualLabel(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function getInterestsCategoryId(
  admin: ReturnType<typeof createServiceRoleClient>,
): Promise<number | null> {
  const { data, error } = await admin
    .from("tag_categories")
    .select("id")
    .eq("name", INTERESTS_CATEGORY_NAME)
    .maybeSingle();
  if (error || data?.id == null) {
    return null;
  }
  return data.id;
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function pickUniqueInterestSlug(
  admin: ReturnType<typeof createServiceRoleClient>,
  base: string,
): Promise<string> {
  let candidate = base;
  let i = 0;
  for (;;) {
    const { data } = await admin.from("tags").select("id").eq("slug", candidate).maybeSingle();
    if (!data) {
      return candidate;
    }
    i += 1;
    candidate = `${base}_${i}`;
  }
}

export async function listInterestTagsAction(
  query?: string,
): Promise<
  { ok: true; tags: AdminInterestTagRow[] } | { ok: false; message: string }
> {
  await requireAdminOrRedirect();
  const admin = createServiceRoleClient();
  const categoryId = await getInterestsCategoryId(admin);
  if (categoryId == null) {
    return { ok: false, message: "Категорію «Інтереси» не знайдено." };
  }

  const trimmedQuery = query?.trim() ?? "";
  let request = admin
    .from("tags")
    .select("id, slug, label_uk, updated_at")
    .eq("category_id", categoryId);

  if (trimmedQuery.length > 0) {
    request = request.ilike("label_uk", `%${escapeIlikePattern(trimmedQuery)}%`);
  }

  const { data, error } = await request.order("label_uk", { ascending: true });

  if (error) {
    return { ok: false, message: "Не вдалося завантажити список інтересів." };
  }

  const rows = data ?? [];
  const tags: AdminInterestTagRow[] = rows.map((r) => ({
    id: r.id,
    labelUk: r.label_uk,
    slug: r.slug,
    updatedAt: r.updated_at,
  }));

  return { ok: true, tags };
}

export async function createInterestTagAction(
  labelUk: string,
  slugOverride?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdminOrRedirect();
  const trimmed = labelUk.trim();
  if (!trimmed) {
    return { ok: false, message: "Введіть назву інтересу." };
  }

  const admin = createServiceRoleClient();
  const categoryId = await getInterestsCategoryId(admin);
  if (categoryId == null) {
    return { ok: false, message: "Категорію «Інтереси» не знайдено." };
  }

  const { data: existingRows } = await admin
    .from("tags")
    .select("id, label_uk")
    .eq("category_id", categoryId);

  const hasDup = (existingRows ?? []).some((r) => tagsRowsEqualLabel(r.label_uk, trimmed));
  if (hasDup) {
    return { ok: false, message: DUPLICATE_INTEREST_LABEL_MESSAGE };
  }

  let slug: string;
  if (slugOverride && slugOverride.trim()) {
    slug = normalizeManualInterestSlug(slugOverride);
    if (!slug || !/^int_[a-z0-9_]+$/.test(slug)) {
      return {
        ok: false,
        message:
          "Некоректний slug: лише латинські літери, цифри та підкреслення після префіксу int_.",
      };
    }
    const { data: slugTaken } = await admin.from("tags").select("id").eq("slug", slug).maybeSingle();
    if (slugTaken) {
      return { ok: false, message: INTEREST_SLUG_TAKEN_MESSAGE };
    }
  } else {
    const base = buildInterestSlugFromLabel(trimmed);
    slug = await pickUniqueInterestSlug(admin, base);
  }

  const { error } = await admin.from("tags").insert({
    category_id: categoryId,
    slug,
    label_uk: trimmed,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: INTEREST_SLUG_TAKEN_MESSAGE };
    }
    return { ok: false, message: "Не вдалося створити інтерес." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateInterestTagAction(
  tagId: number,
  labelUk: string,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdminOrRedirect();
  const trimmed = labelUk.trim();
  if (!trimmed) {
    return { ok: false, message: "Введіть назву інтересу." };
  }

  const admin = createServiceRoleClient();
  const categoryId = await getInterestsCategoryId(admin);
  if (categoryId == null) {
    return { ok: false, message: "Категорію «Інтереси» не знайдено." };
  }

  const { data: tag, error: readError } = await admin
    .from("tags")
    .select("id, category_id, label_uk")
    .eq("id", tagId)
    .maybeSingle();

  if (readError || !tag || tag.category_id !== categoryId) {
    return { ok: false, message: INTEREST_TAG_NOT_FOUND_MESSAGE };
  }

  if (!tagsRowsEqualLabel(tag.label_uk, trimmed)) {
    const { data: siblings } = await admin
      .from("tags")
      .select("id, label_uk")
      .eq("category_id", categoryId);

    const dup = (siblings ?? []).some(
      (r) => r.id !== tagId && tagsRowsEqualLabel(r.label_uk, trimmed),
    );
    if (dup) {
      return { ok: false, message: DUPLICATE_INTEREST_LABEL_MESSAGE };
    }
  }

  const { data: updated, error } = await admin
    .from("tags")
    .update({ label_uk: trimmed })
    .eq("id", tagId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: DUPLICATE_INTEREST_LABEL_MESSAGE };
    }
    return { ok: false, message: "Не вдалося оновити інтерес." };
  }
  if (!updated?.length) {
    return { ok: false, message: STALE_INTEREST_TAG_MESSAGE };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteInterestTagAction(
  tagId: number,
  expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdminOrRedirect();

  const admin = createServiceRoleClient();
  const categoryId = await getInterestsCategoryId(admin);
  if (categoryId == null) {
    return { ok: false, message: "Категорію «Інтереси» не знайдено." };
  }

  const { data: tag, error: readError } = await admin
    .from("tags")
    .select("id, category_id")
    .eq("id", tagId)
    .maybeSingle();

  if (readError || !tag || tag.category_id !== categoryId) {
    return { ok: false, message: INTEREST_TAG_NOT_FOUND_MESSAGE };
  }

  const { data: deleted, error } = await admin
    .from("tags")
    .delete()
    .eq("id", tagId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");

  if (error) {
    return { ok: false, message: "Не вдалося видалити інтерес." };
  }
  if (!deleted?.length) {
    return { ok: false, message: STALE_INTEREST_TAG_MESSAGE };
  }

  revalidatePath("/admin");
  return { ok: true };
}
