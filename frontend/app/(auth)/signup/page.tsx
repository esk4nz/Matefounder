"use client";

import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { registerSchema, type RegisterValues } from "@/app/schemas/auth";
import { signupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/layout/google-sign-in-button";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [actionState, formAction, isPending] = useActionState(signupAction, undefined);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: RegisterValues) => {
    const fd = new FormData();
    fd.set("firstName", data.firstName);
    fd.set("lastName", data.lastName);
    fd.set("username", data.username);
    fd.set("email", data.email);
    fd.set("password", data.password);
    fd.set("confirmPassword", data.confirmPassword);
    startTransition(() => {
      formAction(fd);
    });
  };

  const serverError =
    actionState && actionState.ok === false ? actionState.message : null;

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-white border-none shadow-[0_20px_60px_-15px_rgba(30,64,175,0.1)] ring-1 ring-blue-100">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
            Mate<span className="text-blue-600">founder</span>
          </CardTitle>
          <CardDescription className="text-slate-500">
            Створи акаунт, щоб знайти метч
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          <form
            action={formAction}
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit(onSubmit)(e);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label
                  htmlFor="firstName"
                  className={`text-xs font-bold ${form.formState.errors.firstName ? "text-red-500" : "text-slate-700"}`}
                >
                  Ім'я
                </Label>
                <Input
                  {...form.register("firstName")}
                  id="firstName"
                  autoComplete="given-name"
                  placeholder="Ім’я"
                  className={
                    form.formState.errors.firstName
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {form.formState.errors.firstName ? (
                  <span className="text-[10px] font-bold text-red-500 uppercase">
                    {form.formState.errors.firstName.message}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-1">
                <Label
                  htmlFor="lastName"
                  className={`text-xs font-bold ${form.formState.errors.lastName ? "text-red-500" : "text-slate-700"}`}
                >
                  Прізвище
                </Label>
                <Input
                  {...form.register("lastName")}
                  id="lastName"
                  autoComplete="family-name"
                  placeholder="Прізвище"
                  className={
                    form.formState.errors.lastName
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {form.formState.errors.lastName ? (
                  <span className="text-[10px] font-bold text-red-500 uppercase">
                    {form.formState.errors.lastName.message}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="username"
                className={form.formState.errors.username ? "text-red-500" : ""}
              >
                Логін
              </Label>
              <Input
                {...form.register("username")}
                id="username"
                autoComplete="username"
                placeholder="cool_neighbour"
                className={
                  form.formState.errors.username
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {form.formState.errors.username ? (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.username.message}
                </span>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="email"
                className={form.formState.errors.email ? "text-red-500" : ""}
              >
                Email
              </Label>
              <Input
                {...form.register("email")}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="newneighbour@gmail.com"
                className={
                  form.formState.errors.email
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {form.formState.errors.email ? (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.email.message}
                </span>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="password"
                className={
                  form.formState.errors.password ? "text-red-500" : "text-slate-700"
                }
              >
                Пароль
              </Label>
              <div className="relative">
                <Input
                  {...form.register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`pr-10 ${form.formState.errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.formState.errors.password ? (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.password.message}
                </span>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="confirmPassword"
                className={
                  form.formState.errors.confirmPassword ? "text-red-500" : "text-slate-700"
                }
              >
                Підтвердження
              </Label>
              <div className="relative">
                <Input
                  {...form.register("confirmPassword")}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`pr-10 ${form.formState.errors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.formState.errors.confirmPassword ? (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.confirmPassword.message}
                </span>
              ) : null}
            </div>

            {serverError ? (
              <p className="text-sm text-red-600" role="alert">
                {serverError}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 transition-all active:scale-[0.98] cursor-pointer"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Зареєструватися"}
            </Button>
          </form>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <Separator className="bg-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-slate-400 font-bold">
                Або через
              </span>
            </div>
          </div>

          <GoogleSignInButton />
        </CardContent>

        <CardFooter className="flex justify-center pb-8">
          <div className="text-sm text-slate-500 font-medium">
            Вже маєте акаунт?{" "}
            <Button
              asChild
              variant="link"
              className="h-auto px-0 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              <Link href="/login">Увійти</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
