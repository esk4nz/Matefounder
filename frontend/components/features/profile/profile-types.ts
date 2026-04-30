import type { ProfileRole } from "@/lib/profile/options";

export type ProfileInitialData = {
  username: string;
  firstName: string;
  lastName: string;
  role: ProfileRole;
  region: string;
  city: string;
  bio: string;
  avatarUrl: string | null;
};

export type ProfileSettingsProps = {
  initialEmail: string;
  initialProfile: ProfileInitialData;
  canManageCredentials: boolean;
  canDeleteWithPassword: boolean;
  hasPassword: boolean;
  isAdmin: boolean;
};
