export type ProfileGender = "male" | "female";

export type ProfileGenderForm = "" | ProfileGender;

export type ProfileTagRow = {
  id: number;
  slug: string;
  label_uk: string;
  category: string;
};

export type ProfileTagSelectionsExclusive = {
  habits: number | null;
  routine: number | null;
  social: number | null;
  pets: number | null;
};

export type ProfileInitialData = {
  username: string;
  firstName: string;
  lastName: string;
  gender: ProfileGenderForm;
  bio: string;
  contactPhone: string;
  contactTelegram: string;
  avatarUrl: string | null;
  tagSelections: ProfileTagSelectionsExclusive;
  tagInterests: number[];
  updatedAt: string;
};

export type ProfileSettingsProps = {
  initialEmail: string;
  initialProfile: ProfileInitialData;
  allTags: ProfileTagRow[];
  canManageCredentials: boolean;
  canDeleteWithPassword: boolean;
  hasPassword: boolean;
  isAdmin: boolean;
};
