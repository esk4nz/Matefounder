import { useState, type FormEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFormState } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import type { ProfileMessage } from "@/app/actions/profile";
import type { ProfilePasswordValues } from "@/app/schemas/profile";
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
  form: UseFormReturn<ProfilePasswordValues>;
  state: ProfileMessage | undefined;
  pending: boolean;
  action: (payload: FormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  canManageCredentials: boolean;
  providerLabel: string;
  showCurrentPassword: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onToggleCurrentPassword: () => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
};

export function ProfilePasswordCard({
  form,
  state,
  pending,
  action,
  onSubmit,
  onReset,
  canManageCredentials,
  providerLabel,
  showCurrentPassword,
  showPassword,
  showConfirmPassword,
  onToggleCurrentPassword,
  onTogglePassword,
  onToggleConfirmPassword,
}: Props) {
  const { errors } = useFormState({
    control: form.control,
    name: ["currentPassword", "newPassword", "confirmPassword"],
  });
  const [hiddenState, setHiddenState] = useState<ProfileMessage | undefined>(undefined);
  const visibleState = pending || state === hiddenState ? undefined : state;

  const clearActionMessage = () => {
    if (visibleState) {
      setHiddenState(state);
    }
  };

  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-bold text-slate-900">Пароль</CardTitle>
        <CardDescription>
          {canManageCredentials
            ? "Введіть поточний пароль, а потім задайте новий."
            : `Для акаунта з входом через ${providerLabel} зміна пароля недоступна.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {canManageCredentials ? (
          <form
            action={action}
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              setHiddenState(state);
              onSubmit(event);
            }}
          >
            <div className="grid gap-1">
              <Label
                htmlFor="currentPassword"
                className={errors.currentPassword ? "text-red-500" : "text-slate-700"}
              >
                Поточний пароль
              </Label>
              <div className="relative">
                <Input
                  {...form.register("currentPassword", {
                    onChange: clearActionMessage,
                  })}
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`pr-10 ${errors.currentPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={onToggleCurrentPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError message={errors.currentPassword?.message} />
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="newPassword"
                className={errors.newPassword ? "text-red-500" : "text-slate-700"}
              >
                Новий пароль
              </Label>
              <div className="relative">
                <Input
                  {...form.register("newPassword", {
                    onChange: clearActionMessage,
                  })}
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`pr-10 ${errors.newPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError message={errors.newPassword?.message} />
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="confirmPassword"
                className={errors.confirmPassword ? "text-red-500" : "text-slate-700"}
              >
                Підтвердження нового пароля
              </Label>
              <div className="relative">
                <Input
                  {...form.register("confirmPassword", {
                    onChange: clearActionMessage,
                  })}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`pr-10 ${errors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={onToggleConfirmPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError message={errors.confirmPassword?.message} />
            </div>

            <ActionMessage state={visibleState} />

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
                {pending ? "Оновлення..." : "Оновити пароль"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
            Пароль для цього акаунта керується через {providerLabel}. Якщо хочете керувати
            паролем вручну, увійдіть через email/password акаунт.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
