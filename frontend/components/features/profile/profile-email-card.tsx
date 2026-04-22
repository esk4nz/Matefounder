import type { FormEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFormState } from "react-hook-form";
import type { ProfileMessage } from "@/app/actions/profile";
import type { ProfileEmailValues } from "@/app/schemas/profile";
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
  form: UseFormReturn<ProfileEmailValues>;
  state: ProfileMessage | undefined;
  pending: boolean;
  action: (payload: FormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  initialEmail: string;
  canManageCredentials: boolean;
  providerLabel: string;
};

export function ProfileEmailCard({
  form,
  state,
  pending,
  action,
  onSubmit,
  onReset,
  initialEmail,
  canManageCredentials,
  providerLabel,
}: Props) {
  const { errors } = useFormState({
    control: form.control,
  });

  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-bold text-slate-900">Email</CardTitle>
        <CardDescription>
          {canManageCredentials
            ? "Оновіть email для входу. Supabase може попросити підтвердження через лист."
            : `Цей акаунт використовує ${providerLabel}. Email тут не редагується.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-1">
          <Label htmlFor="currentEmail" className="text-slate-700">
            Поточний email
          </Label>
          <Input id="currentEmail" value={initialEmail} disabled readOnly />
        </div>

        {canManageCredentials ? (
          <form action={action} noValidate className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-1">
              <Label
                htmlFor="email"
                className={errors.email ? "text-red-500" : "text-slate-700"}
              >
                Новий email
              </Label>
              <Input
                {...form.register("email")}
                id="email"
                type="email"
                autoComplete="email"
                className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <FieldError message={errors.email?.message} />
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
                variant="outline"
                className="h-11 cursor-pointer px-5 font-bold"
              >
                {pending ? "Оновлення..." : "Оновити email"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
            Email для цього акаунта керується через {providerLabel}. Якщо потрібно змінити
            пошту, зробіть це у провайдера входу або використовуйте email/password акаунт.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
