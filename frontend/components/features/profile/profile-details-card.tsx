import type { FormEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Controller, useFormState, useWatch } from "react-hook-form";
import { PencilLine, Upload, UserRound } from "lucide-react";
import type { ProfileMessage } from "@/app/actions/profile";
import type { NormalizedProfileValues, ProfileValues } from "@/app/schemas/profile";
import { ActionMessage, FieldError } from "@/components/features/profile/profile-form-feedback";
import { ProfileTagsChips } from "@/components/features/profile/profile-tags-chips";
import type { ProfileTagRow } from "@/components/features/profile/profile-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  form: UseFormReturn<ProfileValues, undefined, NormalizedProfileValues>;
  allTags: ProfileTagRow[];
  state: ProfileMessage | undefined;
  pending: boolean;
  action: (payload: FormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  avatarPreviewUrl: string | null;
  avatarInputVersion: number;
  isAdmin: boolean;
  onAvatarChange: (file: File | null) => void;
  onAvatarRemove: () => void;
};

export function ProfileDetailsCard({
  form,
  allTags,
  state,
  pending,
  action,
  onSubmit,
  onReset,
  avatarPreviewUrl,
  avatarInputVersion,
  isAdmin,
  onAvatarChange,
  onAvatarRemove,
}: Props) {
  const { errors } = useFormState({
    control: form.control,
  });
  const bioValue = useWatch({
    control: form.control,
    name: "bio",
  });

  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <PencilLine className="size-5 text-blue-600" />
          Основна інформація
        </CardTitle>
        {isAdmin ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-blue-900">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Адміністраторський акаунт
            </p>
            <p className="mt-1 text-sm font-semibold">
              Цей профіль має права адміністратора.
            </p>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <form action={action} noValidate className="grid gap-5" onSubmit={onSubmit}>
          <div className="grid gap-3">
            <Label className="text-slate-700">Фото профілю</Label>
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center">
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="size-10 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Label
                    htmlFor="avatar-upload"
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                  >
                    <Upload className="size-4" />
                    Завантажити фото
                  </Label>
                  <input
                    key={avatarInputVersion}
                    id="avatar-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={(event) => {
                      onAvatarChange(event.target.files?.[0] ?? null);
                    }}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 cursor-pointer"
                    onClick={onAvatarRemove}
                  >
                    Видалити фото
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  PNG, JPG або WEBP.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label
                htmlFor="firstName"
                className={errors.firstName ? "text-red-500" : "text-slate-700"}
              >
                Ім&apos;я
              </Label>
              <Controller
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="firstName"
                    autoComplete="given-name"
                    className={errors.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                )}
              />
              <FieldError message={errors.firstName?.message} />
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="lastName"
                className={errors.lastName ? "text-red-500" : "text-slate-700"}
              >
                Прізвище
              </Label>
              <Controller
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="lastName"
                    autoComplete="family-name"
                    className={errors.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                )}
              />
              <FieldError message={errors.lastName?.message} />
            </div>
          </div>

          <div className="grid gap-1">
            <Label
              htmlFor="username"
              className={errors.username ? "text-red-500" : "text-slate-700"}
            >
              Логін
            </Label>
            <Controller
              control={form.control}
              name="username"
              render={({ field }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id="username"
                  autoComplete="username"
                  className={errors.username ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              )}
            />
            <FieldError message={errors.username?.message} />
          </div>

          <div className="grid gap-1">
            <Label
              htmlFor="contactPhone"
              className={errors.contactPhone ? "text-red-500" : "text-slate-700"}
            >
              Номер телефону
            </Label>
            <Controller
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id="contactPhone"
                  autoComplete="tel"
                  placeholder="+380XXXXXXXXX"
                  className={errors.contactPhone ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              )}
            />
            <p className="text-xs text-slate-500">
              Ваш номер побачать лише ті користувачі, чий запит на співпроживання ви схвалите.
            </p>
            <FieldError message={errors.contactPhone?.message} />
          </div>

          <div className="grid gap-1">
            <Label
              htmlFor="contactTelegram"
              className={errors.contactTelegram ? "text-red-500" : "text-slate-700"}
            >
              Telegram (опціонально)
            </Label>
            <Controller
              control={form.control}
              name="contactTelegram"
              render={({ field }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id="contactTelegram"
                  autoComplete="off"
                  placeholder="@username"
                  className={errors.contactTelegram ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              )}
            />
            <p className="text-xs text-slate-500">Наприклад: @username</p>
            <FieldError message={errors.contactTelegram?.message} />
          </div>

          <div className="grid gap-2">
            <Label
              id="gender-label"
              className={errors.gender ? "text-red-500" : "text-slate-700"}
            >
              Стать
            </Label>
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-labelledby="gender-label"
                  className="grid max-w-md grid-cols-2 gap-3"
                >
                  <label
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-2xl border-2 px-4 py-3.5 text-center text-sm font-bold transition-colors",
                      field.value === "female"
                        ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                      errors.gender ? "border-red-400" : "",
                    )}
                  >
                    <input
                      type="radio"
                      name="profile-gender"
                      value="female"
                      className="sr-only"
                      checked={field.value === "female"}
                      onChange={() => {
                        field.onChange("female");
                      }}
                    />
                    Жінка
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-2xl border-2 px-4 py-3.5 text-center text-sm font-bold transition-colors",
                      field.value === "male"
                        ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                      errors.gender ? "border-red-400" : "",
                    )}
                  >
                    <input
                      type="radio"
                      name="profile-gender"
                      value="male"
                      className="sr-only"
                      checked={field.value === "male"}
                      onChange={() => {
                        field.onChange("male");
                      }}
                    />
                    Чоловік
                  </label>
                </div>
              )}
            />
            <FieldError message={errors.gender?.message} />
          </div>

          <ProfileTagsChips form={form} allTags={allTags} />

          <div className="grid gap-1">
            <Label
              htmlFor="bio"
              className={errors.bio ? "text-red-500" : "text-slate-700"}
            >
              Опис себе
            </Label>
            <Controller
              control={form.control}
              name="bio"
              render={({ field }) => (
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id="bio"
                  placeholder="Коротко розкажіть про себе, свій стиль життя, інтереси або очікування від співмешканця."
                  className={`min-h-50 resize-y ${
                    errors.bio ? "border-red-500 focus-visible:ring-red-500" : ""
                  }`}
                />
              )}
            />
            <div className="flex items-center justify-between gap-3">
              <FieldError message={errors.bio?.message} />
              <span className="text-xs text-slate-400">{bioValue?.length ?? 0}/1000</span>
            </div>
          </div>

          <ActionMessage state={state} />

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer px-5 font-bold"
              onClick={onReset}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={pending} className="h-11 cursor-pointer px-5 font-bold">
              {pending ? "Збереження..." : "Зберегти зміни"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
