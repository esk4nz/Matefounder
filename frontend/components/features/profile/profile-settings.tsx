"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useForm } from "react-hook-form";
import {
  deleteAccountAction,
  type ProfileMessage,
  updatePasswordAction,
  updateProfileAction,
} from "@/app/actions/profile";
import {
  type ProfileDeleteValues,
  type NormalizedProfileValues,
  type ProfilePasswordValues,
  type ProfileSetPasswordValues,
  type ProfileValues,
  createProfileFormSchema,
  flattenProfileTagIds,
  profileDeleteSchema,
  profilePasswordSchema,
  profileSetPasswordSchema,
} from "@/app/schemas/profile";
import { ProfileDangerZoneCard } from "@/components/features/profile/profile-danger-zone-card";
import { ProfileDetailsCard } from "@/components/features/profile/profile-details-card";
import { ProfileEmailCard } from "@/components/features/profile/profile-email-card";
import { ProfilePasswordCard } from "@/components/features/profile/profile-password-card";
import { ProfileSetPasswordCard } from "@/components/features/profile/profile-set-password-card";
import type { ProfileSettingsProps } from "@/components/features/profile/profile-types";
import { dispatchNavbarSync } from "@/lib/navbar-sync";

const PROFILE_SUCCESS_MESSAGE_KEY = "matefounder.profile.successMessage";

export function ProfileSettings({
  initialEmail,
  initialProfile,
  allTags,
  canManageCredentials,
  canDeleteWithPassword,
  hasPassword,
  isAdmin,
}: ProfileSettingsProps) {
  const router = useRouter();
  const objectUrlRef = useRef<string | null>(null);
  const profileUpdatedAtRef = useRef(initialProfile.updatedAt);
  const profileDefaultValuesRef = useRef<ProfileValues>({
    username: initialProfile.username,
    firstName: initialProfile.firstName,
    lastName: initialProfile.lastName,
    gender: initialProfile.gender,
    bio: initialProfile.bio,
    tagSelections: initialProfile.tagSelections,
    tagInterests: initialProfile.tagInterests,
  });
  const savedAvatarUrlRef = useRef<string | null>(initialProfile.avatarUrl);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarInputVersion, setAvatarInputVersion] = useState(0);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(initialProfile.avatarUrl);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const message = window.sessionStorage.getItem(PROFILE_SUCCESS_MESSAGE_KEY);
    if (message) {
      window.sessionStorage.removeItem(PROFILE_SUCCESS_MESSAGE_KEY);
      setProfileSuccessMessage(message);
    }
  }, []);

  useEffect(() => {
    profileUpdatedAtRef.current = initialProfile.updatedAt;
  }, [initialProfile.updatedAt]);

  const profileFormSchema = useMemo(() => createProfileFormSchema(allTags), [allTags]);

  const profileForm = useForm<ProfileValues, undefined, NormalizedProfileValues>({
    resolver: zodResolver(profileFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      username: initialProfile.username,
      firstName: initialProfile.firstName,
      lastName: initialProfile.lastName,
      gender: initialProfile.gender,
      bio: initialProfile.bio,
      tagSelections: initialProfile.tagSelections,
      tagInterests: initialProfile.tagInterests,
    },
  });

  const passwordForm = useForm<ProfilePasswordValues>({
    resolver: zodResolver(profilePasswordSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const setPasswordForm = useForm<ProfileSetPasswordValues>({
    resolver: zodResolver(profileSetPasswordSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const deleteForm = useForm<ProfileDeleteValues>({
    resolver: zodResolver(profileDeleteSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
    },
  });

  const handleProfileAction = async (
    previousState: ProfileMessage | undefined,
    formData: FormData,
  ) => {
    const nextState = await updateProfileAction(previousState, formData);

    if (nextState.ok && nextState.profile) {
      const nextProfileValues: ProfileValues = {
        username: nextState.profile.username,
        firstName: nextState.profile.firstName,
        lastName: nextState.profile.lastName,
        gender: nextState.profile.gender,
        bio: nextState.profile.bio,
        tagSelections: nextState.profile.tagSelections,
        tagInterests: nextState.profile.tagInterests,
      };

      profileUpdatedAtRef.current = nextState.profile.updatedAt;
      profileDefaultValuesRef.current = nextProfileValues;
      savedAvatarUrlRef.current = nextState.profile.avatarUrl;
      profileForm.reset(nextProfileValues);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setSelectedAvatarFile(null);
      setRemoveAvatar(false);
      setAvatarInputVersion((version) => version + 1);
      setAvatarPreviewUrl(nextState.profile.avatarUrl);
      const successMessage = nextState.message ?? "Профіль успішно оновлено.";
      setProfileSuccessMessage(successMessage);
      window.sessionStorage.setItem(PROFILE_SUCCESS_MESSAGE_KEY, successMessage);
      router.refresh();
      dispatchNavbarSync();
    } else if (!nextState.ok) {
      setProfileSuccessMessage(null);
    }

    return nextState;
  };

  const [profileState, profileFormAction, profilePending] = useActionState(
    handleProfileAction,
    undefined,
  );
  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    updatePasswordAction,
    undefined,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteAccountAction, undefined);

  const redirectToHome = useCallback((reason?: "profile_not_found") => {
    dispatchNavbarSync();
    router.replace(reason ? `/?error=${reason}` : "/");
    router.refresh();
  }, [router]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      profileState?.reason === "unauthenticated" ||
      profileState?.reason === "missingProfile" ||
      passwordState?.reason === "unauthenticated" ||
      passwordState?.reason === "missingProfile" ||
      deleteState?.reason === "unauthenticated" ||
      deleteState?.reason === "missingProfile"
    ) {
      redirectToHome(
        profileState?.reason === "missingProfile" ||
          passwordState?.reason === "missingProfile" ||
          deleteState?.reason === "missingProfile"
          ? "profile_not_found"
          : undefined,
      );
    }
  }, [deleteState, passwordState, profileState, redirectToHome]);

  useEffect(() => {
    if (!passwordState?.ok) {
      return;
    }

    passwordForm.reset({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordForm.reset({
      newPassword: "",
      confirmPassword: "",
    });
    router.refresh();
    dispatchNavbarSync();
  }, [passwordForm, passwordState, router, setPasswordForm]);

  const handleAvatarChange = (file: File | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setSelectedAvatarFile(file);

    if (file) {
      const previewUrl = URL.createObjectURL(file);
      objectUrlRef.current = previewUrl;
      setAvatarPreviewUrl(previewUrl);
      setRemoveAvatar(false);
      return;
    }

    setAvatarPreviewUrl(removeAvatar ? null : savedAvatarUrlRef.current);
  };

  const handleAvatarRemove = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setSelectedAvatarFile(null);
    setRemoveAvatar(true);
    setAvatarInputVersion((version) => version + 1);
    setAvatarPreviewUrl(null);
  };

  const resetProfileForm = () => {
    profileForm.reset(profileDefaultValuesRef.current);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setSelectedAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarInputVersion((version) => version + 1);
    setAvatarPreviewUrl(savedAvatarUrlRef.current);
  };

  const resetPasswordForm = () => {
    passwordForm.reset({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowCurrentPassword(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const resetSetPasswordForm = () => {
    setPasswordForm.reset({
      newPassword: "",
      confirmPassword: "",
    }, {
      keepDirty: false,
      keepErrors: false,
      keepIsSubmitted: false,
      keepSubmitCount: false,
      keepTouched: false,
    });
    setPasswordForm.clearErrors();
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const resetDeleteForm = () => {
    deleteForm.reset({
      password: "",
    });
  };

  const onProfileSubmit = (data: NormalizedProfileValues) => {
    const fd = new FormData();
    fd.set("expectedUpdatedAt", profileUpdatedAtRef.current);
    fd.set("username", data.username);
    fd.set("firstName", data.firstName);
    fd.set("lastName", data.lastName);
    fd.set("gender", data.gender);
    fd.set("bio", data.bio ?? "");
    fd.set("tagIds", JSON.stringify(flattenProfileTagIds(data)));
    fd.set("removeAvatar", String(removeAvatar));

    if (selectedAvatarFile) {
      fd.set("avatar", selectedAvatarFile);
    }

    startTransition(() => {
      profileFormAction(fd);
    });
  };

  const onPasswordSubmit = (data: ProfilePasswordValues) => {
    const fd = new FormData();
    fd.set("currentPassword", data.currentPassword);
    fd.set("newPassword", data.newPassword);
    fd.set("confirmPassword", data.confirmPassword);

    startTransition(() => {
      passwordFormAction(fd);
    });
  };

  const onSetPasswordSubmit = (data: ProfileSetPasswordValues) => {
    const fd = new FormData();
    fd.set("newPassword", data.newPassword);
    fd.set("confirmPassword", data.confirmPassword);

    startTransition(() => {
      passwordFormAction(fd);
    });
  };

  const onDeleteSubmit = (data: ProfileDeleteValues) => {
    const fd = new FormData();
    fd.set("password", data.password);

    startTransition(() => {
      deleteFormAction(fd);
    });
  };

  const handleProfileFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSuccessMessage(null);
    void profileForm.handleSubmit((data) => {
      onProfileSubmit(data);
    })(event);
  };

  const handlePasswordFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void passwordForm.handleSubmit((data) => {
      onPasswordSubmit(data);
    })(event);
  };

  const handleSetPasswordFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void setPasswordForm.handleSubmit((data) => {
      onSetPasswordSubmit(data);
    })(event);
  };

  const handleDeleteFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void deleteForm.handleSubmit((data) => {
      onDeleteSubmit(data);
    })(event);
  };

  return (
    <section className="container mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <ProfileDetailsCard
          form={profileForm}
          allTags={allTags}
          state={
            profileSuccessMessage
              ? { ok: true, message: profileSuccessMessage }
              : profileState
          }
          pending={profilePending}
          action={profileFormAction}
          onSubmit={handleProfileFormSubmit}
          onReset={resetProfileForm}
          avatarPreviewUrl={avatarPreviewUrl}
          avatarInputVersion={avatarInputVersion}
          onAvatarChange={handleAvatarChange}
          onAvatarRemove={handleAvatarRemove}
          isAdmin={isAdmin}
        />

        <div className="grid gap-6">
          <ProfileEmailCard
            initialEmail={initialEmail}
          />

          {hasPassword ? (
            <ProfilePasswordCard
              form={passwordForm}
              state={passwordState}
              pending={passwordPending}
              action={passwordFormAction}
              onSubmit={handlePasswordFormSubmit}
              onReset={resetPasswordForm}
              canManageCredentials={canManageCredentials}
              showCurrentPassword={showCurrentPassword}
              showPassword={showPassword}
              showConfirmPassword={showConfirmPassword}
              onToggleCurrentPassword={() => setShowCurrentPassword((value) => !value)}
              onTogglePassword={() => setShowPassword((value) => !value)}
              onToggleConfirmPassword={() => setShowConfirmPassword((value) => !value)}
            />
          ) : (
            <ProfileSetPasswordCard
              form={setPasswordForm}
              state={passwordState}
              pending={passwordPending}
              action={passwordFormAction}
              onSubmit={handleSetPasswordFormSubmit}
              onReset={resetSetPasswordForm}
              showPassword={showPassword}
              showConfirmPassword={showConfirmPassword}
              onTogglePassword={() => setShowPassword((value) => !value)}
              onToggleConfirmPassword={() => setShowConfirmPassword((value) => !value)}
            />
          )}

          <ProfileDangerZoneCard
            form={deleteForm}
            state={deleteState}
            pending={deletePending}
            action={deleteFormAction}
            onSubmit={handleDeleteFormSubmit}
            onReset={resetDeleteForm}
            canDeleteWithPassword={canDeleteWithPassword}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </section>
  );
}
