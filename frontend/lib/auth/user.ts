import type { User } from "@supabase/supabase-js";

export function getIdentityProviders(user: User) {
  const providers = new Set<string>();

  for (const identity of user.identities ?? []) {
    if (typeof identity.provider === "string" && identity.provider) {
      providers.add(identity.provider);
    }
  }

  if (typeof user.app_metadata?.provider === "string" && user.app_metadata.provider) {
    providers.add(user.app_metadata.provider);
  }

  return Array.from(providers);
}

export function userHasPassword(user: User) {
  const providers = getIdentityProviders(user);
  return providers.includes("email") || user.user_metadata?.has_password === true;
}
