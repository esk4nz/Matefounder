"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import {
  deleteAccountAction,
  updateEmailAction,
  updatePasswordAction,
  updateProfileAction,
} from "@/app/actions/profile";
import {
  type ProfileDeleteValues,
  type NormalizedProfileValues,
  type ProfileEmailValues,
  type ProfilePasswordValues,
  type ProfileValues,
  profileDeleteSchema,
  profileEmailSchema,
  profilePasswordSchema,
  profileSchema,
} from "@/app/schemas/profile";
import { ProfileDangerZoneCard } from "@/components/features/profile/profile-danger-zone-card";
import { ProfileDetailsCard } from "@/components/features/profile/profile-details-card";
import { ProfileEmailCard } from "@/components/features/profile/profile-email-card";
import { ProfilePasswordCard } from "@/components/features/profile/profile-password-card";
import type { ProfileSettingsProps } from "@/components/features/profile/profile-types";

export function ProfileSettings({
  initialEmail,
  initialProfile,
  canManageCredentials,
  canDeleteWithPassword,
  providerLabel,
}: ProfileSettingsProps) {
  const router = useRouter();
  const objectUrlRef = useRef<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(initialProfile.avatarUrl);
  const [profileState, profileFormAction, profilePending] = useActionState(updateProfileAction, undefined);
  const [emailState, emailFormAction, emailPending] = useActionState(updateEmailAction, undefined);
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

  const emailForm = useForm<ProfileEmailValues>({
    resolver: zodResolver(profileEmailSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      email: initialEmail,
    },
  });

  const passwordForm = useForm<ProfilePasswordValues>({
    resolver: zodResolver(profilePasswordSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
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
    if (!emailState?.ok) {
      return;
    }

    router.refresh();
  }, [emailState, router]);

  useEffect(() => {
    if (!passwordState?.ok) {
      return;
    }

    passwordForm.reset({
      password: "",
      confirmPassword: "",
    });
  }, [passwordForm, passwordState]);

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

  const resetEmailForm = () => {
    emailForm.reset({
      email: initialEmail,
    });
  };

  const resetPasswordForm = () => {
    passwordForm.reset({
      password: "",
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

  const onEmailSubmit = (data: ProfileEmailValues) => {
    const fd = new FormData();
    fd.set("email", data.email);

    startTransition(() => {
      emailFormAction(fd);
    });
  };

  const onPasswordSubmit = (data: ProfilePasswordValues) => {
    const fd = new FormData();
    fd.set("password", data.password);
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

  const handleEmailFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void emailForm.handleSubmit(onEmailSubmit)(event);
  };

  const handlePasswordFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void passwordForm.handleSubmit(onPasswordSubmit)(event);
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
            form={emailForm}
            state={emailState}
            pending={emailPending}
            action={emailFormAction}
            onSubmit={handleEmailFormSubmit}
            onReset={resetEmailForm}
            initialEmail={initialEmail}
            canManageCredentials={canManageCredentials}
            providerLabel={providerLabel}
          />

          <ProfilePasswordCard
            form={passwordForm}
            state={passwordState}
            pending={passwordPending}
            action={passwordFormAction}
            onSubmit={handlePasswordFormSubmit}
            onReset={resetPasswordForm}
            canManageCredentials={canManageCredentials}
            providerLabel={providerLabel}
            showPassword={showPassword}
            showConfirmPassword={showConfirmPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
            onToggleConfirmPassword={() => setShowConfirmPassword((value) => !value)}
          />

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
