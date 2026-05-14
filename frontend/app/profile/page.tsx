import { redirect } from "next/navigation";
import { ProfileSettings } from "@/components/features/profile/profile-settings";
import { PAGE_SHELL_CLASS } from "@/lib/utils";
import type { ProfileGenderForm, ProfileTagRow, BlockedUserListRow } from "@/components/features/profile/profile-types";
import { buildInitialTagFormState } from "@/app/schemas/profile";
import { userHasPassword } from "@/lib/auth/user";
import { mapTagsQueryToProfileRows, TAGS_WITH_CATEGORY_SELECT } from "@/lib/profile/map-tags";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [profileResult, tagsResult, profileTagsResult, blocksResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "username, first_name, last_name, bio, contact_phone, contact_telegram, avatar_path, is_admin, gender, updated_at",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("tags")
      .select(TAGS_WITH_CATEGORY_SELECT)
      .order("category_id", { ascending: true })
      .order("slug", { ascending: true }),
    supabase.from("profile_tags").select("tag_id").eq("profile_id", user.id),
    supabase
      .from("user_blocks")
      .select("blocked_id, created_at")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileResult.data;
  const tagsRaw = tagsResult.data ?? [];
  const profileTagsRaw = profileTagsResult.data ?? [];
  const blockRows = blocksResult.error ? [] : (blocksResult.data ?? []);

  if (!profile) {
    redirect("/?error=profile_not_found");
  }

  const allTags: ProfileTagRow[] = mapTagsQueryToProfileRows(tagsRaw);

  const selectedTagIds = profileTagsRaw.map((row) => row.tag_id);
  const { tagSelections, tagInterests } = buildInitialTagFormState(allTags, selectedTagIds);

  const gender: ProfileGenderForm =
    profile.gender === "male" || profile.gender === "female" ? profile.gender : "";

  const hasPassword = userHasPassword(user);
  const isAdmin = profile.is_admin === true;
  const canManageCredentials = hasPassword;
  const canDeleteWithPassword = hasPassword && !isAdmin;
  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("profile-images").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;
  const firstNameFallback =
    profile.first_name || String(user.user_metadata?.first_name ?? user.user_metadata?.given_name ?? "");
  const lastNameFallback =
    profile.last_name || String(user.user_metadata?.last_name ?? user.user_metadata?.family_name ?? "");

  const blockedIds = blockRows.map((row) => row.blocked_id);
  let blockedUsers: BlockedUserListRow[] = [];
  if (blockedIds.length > 0) {
    const profRes = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_path")
      .in("id", blockedIds);
    const profileById = new Map((profRes.data ?? []).map((p) => [p.id, p] as const));
    blockedUsers = blockRows.map((row) => {
      const p = profileById.get(row.blocked_id);
      if (!p) {
        return {
          id: row.blocked_id,
          username: "",
          firstName: "",
          lastName: "",
          avatarUrl: null,
        };
      }
      const rowAvatarUrl = p.avatar_path
        ? supabase.storage.from("profile-images").getPublicUrl(p.avatar_path).data.publicUrl
        : null;
      return {
        id: p.id,
        username: p.username ?? "",
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        avatarUrl: rowAvatarUrl,
      };
    });
  }

  return (
    <section className={PAGE_SHELL_CLASS}>
    <ProfileSettings
      key={`${user.id}:${profile.updated_at}`}
      allTags={allTags}
      initialEmail={user.email ?? ""}
      initialProfile={{
        username: profile.username,
        firstName: firstNameFallback,
        lastName: lastNameFallback,
        gender,
        bio: profile.bio ?? "",
        contactPhone: profile.contact_phone ?? "",
        contactTelegram: profile.contact_telegram ?? "",
        avatarUrl,
        tagSelections,
        tagInterests,
        updatedAt: profile.updated_at,
      }}
      canManageCredentials={canManageCredentials}
      canDeleteWithPassword={canDeleteWithPassword}
      hasPassword={hasPassword}
      isAdmin={isAdmin}
      blockedUsers={blockedUsers}
    />
    </section>
  );
}
