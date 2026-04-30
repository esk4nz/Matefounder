import type { FormEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Controller, useFormState, useWatch } from "react-hook-form";
import { PencilLine, Upload, UserRound } from "lucide-react";
import type { ProfileMessage } from "@/app/actions/profile";
import type { NormalizedProfileValues, ProfileValues } from "@/app/schemas/profile";
import { ActionMessage, FieldError } from "@/components/features/profile/profile-form-feedback";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PROFILE_ROLE_OPTIONS,
  REGION_OPTIONS,
  getCitiesForRegion,
  isValidCityForRegion,
} from "@/lib/profile/options";

type Props = {
  form: UseFormReturn<ProfileValues, undefined, NormalizedProfileValues>;
  state: ProfileMessage | undefined;
  pending: boolean;
  action: (payload: FormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  avatarPreviewUrl: string | null;
  avatarInputVersion: number;
  onAvatarChange: (file: File | null) => void;
  onAvatarRemove: () => void;
};

export function ProfileDetailsCard({
  form,
  state,
  pending,
  action,
  onSubmit,
  onReset,
  avatarPreviewUrl,
  avatarInputVersion,
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
  const regionValue = useWatch({
    control: form.control,
    name: "region",
  });
  const cityOptions = getCitiesForRegion(regionValue ?? "");

  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <PencilLine className="size-5 text-blue-600" />
          Основна інформація
        </CardTitle>
        <CardDescription>
          Ім&apos;я, логін, фото, роль у пошуку та короткий опис себе. Це бачать інші
          користувачі.
        </CardDescription>
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1 md:col-span-1">
              <Label
                htmlFor="role"
                className={errors.role ? "text-red-500" : "text-slate-700"}
              >
                Моя роль у пошуку
              </Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    {...field}
                    value={field.value ?? ""}
                    id="role"
                    className={errors.role ? "border-red-500 focus-visible:ring-red-500" : ""}
                  >
                    {PROFILE_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              />
              <FieldError message={errors.role?.message} />
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="region"
                className={errors.region ? "text-red-500" : "text-slate-700"}
              >
                Область
              </Label>
              <Controller
                control={form.control}
                name="region"
                render={({ field }) => (
                  <Select
                    {...field}
                    value={field.value ?? ""}
                    id="region"
                    className={errors.region ? "border-red-500 focus-visible:ring-red-500" : ""}
                    onChange={(event) => {
                      field.onChange(event);
                      const nextRegion = event.target.value;
                      const currentCity = form.getValues("city");
                      if (!currentCity || isValidCityForRegion(nextRegion, currentCity)) {
                        return;
                      }

                      form.setValue("city", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    <option value="">Не обрано</option>
                    {REGION_OPTIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </Select>
                )}
              />
              <FieldError message={errors.region?.message} />
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="city"
                className={errors.city ? "text-red-500" : "text-slate-700"}
              >
                Місто
              </Label>
              <Controller
                control={form.control}
                name="city"
                render={({ field }) => (
                  <Select
                    {...field}
                    value={field.value ?? ""}
                    id="city"
                    disabled={!regionValue}
                    className={errors.city ? "border-red-500 focus-visible:ring-red-500" : ""}
                  >
                    <option value="">
                      {regionValue ? "Оберіть місто" : "Спочатку оберіть область"}
                    </option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </Select>
                )}
              />
              <FieldError message={errors.city?.message} />
            </div>
          </div>

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
