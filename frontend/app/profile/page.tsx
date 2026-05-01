import { redirect } from "next/navigation";
import { ProfileSettings } from "@/components/features/profile/profile-settings";
import { userHasPassword } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, first_name, last_name, role, region, city, bio, avatar_path, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/?error=profile_not_found");
  }

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
      key={[
        user.id,
        user.email ?? "",
        profile.username,
        firstNameFallback,
        lastNameFallback,
        profile.role,
        profile.region ?? "",
        profile.city ?? "",
        profile.bio ?? "",
        profile.avatar_path ?? "",
        hasPassword ? "password" : "no-password",
        isAdmin ? "admin" : "user",
      ].join(":")}
      initialEmail={user.email ?? ""}
      initialProfile={{
        username: profile.username,
        firstName: firstNameFallback,
        lastName: lastNameFallback,
        role: profile.role,
        region: profile.region ?? "",
        city: profile.city ?? "",
        bio: profile.bio ?? "",
        avatarUrl,
      }}
      canManageCredentials={canManageCredentials}
      canDeleteWithPassword={canDeleteWithPassword}
      hasPassword={hasPassword}
      isAdmin={isAdmin}
    />
  );
}
