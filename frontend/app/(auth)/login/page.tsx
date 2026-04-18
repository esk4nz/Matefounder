"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginValues } from "@/app/schemas/auth";
import { loginAction } from "@/app/actions/auth";
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

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [actionState, formAction, isPending] = useActionState(loginAction, undefined);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginValues) => {
    const fd = new FormData();
    fd.set("identifier", data.identifier);
    fd.set("password", data.password);
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
            Вхід для пошуку однодумців
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
            <div className="grid gap-2">
              <Label
                htmlFor="identifier"
                className={
                  form.formState.errors.identifier ? "text-red-500" : "text-slate-700"
                }
              >
                Email або Логін
              </Label>
              <Input
                {...form.register("identifier")}
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="you@email.com або логін"
                className={`bg-white border-slate-300 text-slate-900 focus:ring-blue-600 focus:border-blue-600 ${
                  form.formState.errors.identifier ? "border-red-500 focus:ring-red-500" : ""
                }`}
              />
              {form.formState.errors.identifier ? (
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">
                  {form.formState.errors.identifier.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label
                  htmlFor="password"
                  className={
                    form.formState.errors.password ? "text-red-500" : "text-slate-700"
                  }
                >
                  Пароль
                </Label>
                <Button
                  asChild
                  variant="link"
                  className="ml-auto h-auto px-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <Link href="#">Забули пароль?</Link>
                </Button>
              </div>
              <div className="relative">
                <Input
                  {...form.register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  className={`bg-white border-slate-300 text-slate-900 focus:ring-blue-600 focus:border-blue-600 pr-10 ${
                    form.formState.errors.password ? "border-red-500 focus:ring-red-500" : ""
                  }`}
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
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">
                  {form.formState.errors.password.message}
                </p>
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-sm transition-colors active:scale-[0.98] cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Увійти"
              )}
            </Button>
          </form>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <Separator className="bg-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-slate-400 font-bold tracking-tighter">
                Або продовжити через
              </span>
            </div>
          </div>

          <GoogleSignInButton />
        </CardContent>

        <CardFooter className="flex flex-wrap justify-center pb-8">
          <div className="text-sm text-slate-500 font-medium">
            Немає акаунту?{" "}
            <Button
              asChild
              variant="link"
              className="h-auto px-0 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              <Link href="/signup">Зареєструватися</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
