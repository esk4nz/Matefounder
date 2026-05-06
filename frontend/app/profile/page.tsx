import { redirect } from "next/navigation";
import { ProfileSettings } from "@/components/features/profile/profile-settings";
import type { ProfileGenderForm, ProfileTagRow } from "@/components/features/profile/profile-types";
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

  const [profileResult, tagsResult, profileTagsResult] = await Promise.all([
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
  ]);

  const profile = profileResult.data;
  const tagsRaw = tagsResult.data ?? [];
  const profileTagsRaw = profileTagsResult.data ?? [];

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

  return (
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
    />
  );
}
