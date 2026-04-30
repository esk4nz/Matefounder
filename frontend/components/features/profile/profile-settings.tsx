"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import {
  deleteAccountAction,
  updatePasswordAction,
  updateProfileAction,
} from "@/app/actions/profile";
import {
  type ProfileDeleteValues,
  type NormalizedProfileValues,
  type ProfilePasswordValues,
  type ProfileSetPasswordValues,
  type ProfileValues,
  profileDeleteSchema,
  profilePasswordSchema,
  profileSetPasswordSchema,
  profileSchema,
} from "@/app/schemas/profile";
import { ProfileDangerZoneCard } from "@/components/features/profile/profile-danger-zone-card";
import { ProfileDetailsCard } from "@/components/features/profile/profile-details-card";
import { ProfileEmailCard } from "@/components/features/profile/profile-email-card";
import { ProfilePasswordCard } from "@/components/features/profile/profile-password-card";
import { ProfileSetPasswordCard } from "@/components/features/profile/profile-set-password-card";
import type { ProfileSettingsProps } from "@/components/features/profile/profile-types";

export function ProfileSettings({
  initialEmail,
  initialProfile,
  canManageCredentials,
  canDeleteWithPassword,
  hasPassword,
  providerLabel,
}: ProfileSettingsProps) {
  const router = useRouter();
  const objectUrlRef = useRef<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(initialProfile.avatarUrl);
  const [profileState, profileFormAction, profilePending] = useActionState(updateProfileAction, undefined);
  const [passwordState, passwordFormAction, passwordPending] = useActionState(
    updatePasswordAction,
    undefined,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteAccountAction, undefined);

  const profileForm = useForm<ProfileValues, undefined, NormalizedProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      username: initialProfile.username,
      firstName: initialProfile.firstName,
      lastName: initialProfile.lastName,
      role: initialProfile.role,
      region: initialProfile.region,
      city: initialProfile.city,
      bio: initialProfile.bio,
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

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!profileState?.ok) {
      return;
    }

    router.refresh();
  }, [profileState, router]);

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

    setAvatarPreviewUrl(removeAvatar ? null : initialProfile.avatarUrl);
  };

  const handleAvatarRemove = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setSelectedAvatarFile(null);
    setRemoveAvatar(true);
    setAvatarPreviewUrl(null);
  };

  const resetProfileForm = () => {
    profileForm.reset({
      username: initialProfile.username,
      firstName: initialProfile.firstName,
      lastName: initialProfile.lastName,
      role: initialProfile.role,
      region: initialProfile.region,
      city: initialProfile.city,
      bio: initialProfile.bio,
    });

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setSelectedAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreviewUrl(initialProfile.avatarUrl);
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
    });
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
    fd.set("username", data.username);
    fd.set("firstName", data.firstName);
    fd.set("lastName", data.lastName);
    fd.set("role", data.role);
    fd.set("region", data.region ?? "");
    fd.set("city", data.city ?? "");
    fd.set("bio", data.bio ?? "");
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
    void profileForm.handleSubmit(onProfileSubmit)(event);
  };

  const handlePasswordFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void passwordForm.handleSubmit(onPasswordSubmit)(event);
  };

  const handleSetPasswordFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void setPasswordForm.handleSubmit(onSetPasswordSubmit)(event);
  };

  const handleDeleteFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void deleteForm.handleSubmit(onDeleteSubmit)(event);
  };

  return (
    <section className="container mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <ProfileDetailsCard
          form={profileForm}
          state={profileState}
          pending={profilePending}
          action={profileFormAction}
          onSubmit={handleProfileFormSubmit}
          onReset={resetProfileForm}
          avatarPreviewUrl={avatarPreviewUrl}
          onAvatarChange={handleAvatarChange}
          onAvatarRemove={handleAvatarRemove}
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
              providerLabel={providerLabel}
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
              providerLabel={providerLabel}
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
            providerLabel={providerLabel}
          />
        </div>
      </div>
    </section>
  );
}
