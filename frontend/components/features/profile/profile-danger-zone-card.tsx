import type { FormEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFormState } from "react-hook-form";
import type { ProfileMessage } from "@/app/actions/profile";
import type { ProfileDeleteValues } from "@/app/schemas/profile";
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

type Props = {
  form: UseFormReturn<ProfileDeleteValues>;
  state: ProfileMessage | undefined;
  pending: boolean;
  action: (payload: FormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  canDeleteWithPassword: boolean;
  providerLabel: string;
};

export function ProfileDangerZoneCard({
  form,
  state,
  pending,
  action,
  onSubmit,
  onReset,
  canDeleteWithPassword,
  providerLabel,
}: Props) {
  const { errors } = useFormState({
    control: form.control,
  });

  return (
    <Card className="border-red-200 bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-red-100">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-bold text-red-700">Небезпечна зона</CardTitle>
        <CardDescription>
          Видалення акаунта незворотне. Профіль, сесія та пов’язані дані користувача будуть
          очищені.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {canDeleteWithPassword ? (
          <form action={action} noValidate className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-1">
              <Label
                htmlFor="deletePassword"
                className={errors.password ? "text-red-500" : "text-slate-700"}
              >
                Пароль для підтвердження
              </Label>
              <Input
                {...form.register("password")}
                id="deletePassword"
                type="password"
                autoComplete="current-password"
                className={errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <FieldError message={errors.password?.message} />
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
              <Button
                type="submit"
                disabled={pending}
                variant="destructive"
                className="h-11 cursor-pointer px-5 font-bold"
              >
                {pending ? "Видалення..." : "Видалити акаунт"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
            Для цього акаунта видалення через пароль недоступне, бо вхід зараз керується через{" "}
            {providerLabel}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
