import type { User, UserIdentity } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { ProfileSettings } from "@/components/features/profile/profile-settings";
import { createClient } from "@/lib/supabase/server";

function getIdentityProviders(user: User) {
  const providers = new Set(
    (user.identities ?? []).map((identity: UserIdentity) => identity.provider).filter(Boolean),
  );

  if (typeof user.app_metadata?.provider === "string") {
    providers.add(user.app_metadata.provider);
  }

  return Array.from(providers);
}

function getProviderLabel(provider: string) {
  if (provider === "email") {
    return "Email";
  }
  if (provider === "google") {
    return "Google";
  }
  if (provider === "linkedin_oidc") {
    return "LinkedIn";
  }
  return "цього провайдера";
}

function userHasPassword(user: User, providers: string[]) {
  return (
    providers.includes("email") ||
    user.app_metadata?.provider === "email" ||
    user.user_metadata?.has_password === true
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, first_name, last_name, role, region, city, bio, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const providers = getIdentityProviders(user);
  const hasPassword = userHasPassword(user, providers);
  const canManageCredentials = hasPassword;
  const canDeleteWithPassword = hasPassword;
  const externalProviders = providers.filter((provider) => provider !== "email");
  const providerLabel = externalProviders.length
    ? externalProviders.map(getProviderLabel).join(" + ")
    : "Email";
  const avatarUrl = profile?.avatar_path
    ? supabase.storage.from("profile-images").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;
  const firstNameFallback =
    profile?.first_name || String(user.user_metadata?.first_name ?? user.user_metadata?.given_name ?? "");
  const lastNameFallback =
    profile?.last_name || String(user.user_metadata?.last_name ?? user.user_metadata?.family_name ?? "");

  return (
    <ProfileSettings
      key={[
        user.id,
        user.email ?? "",
        profile?.username ?? "",
        profile?.role ?? "",
        profile?.region ?? "",
        profile?.city ?? "",
        profile?.bio ?? "",
        profile?.avatar_path ?? "",
        hasPassword ? "password" : "no-password",
      ].join(":")}
      initialEmail={user.email ?? ""}
      initialProfile={{
        username: profile?.username ?? "",
        firstName: firstNameFallback,
        lastName: lastNameFallback,
        role: profile?.role ?? "seeker",
        region: profile?.region ?? "",
        city: profile?.city ?? "",
        bio: profile?.bio ?? "",
        avatarUrl,
      }}
      canManageCredentials={canManageCredentials}
      canDeleteWithPassword={canDeleteWithPassword}
      hasPassword={hasPassword}
      providerLabel={providerLabel}
    />
  );
}
