"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { registerSchema, type RegisterValues } from "@/app/schemas/auth";
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

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const onSubmit = async (data: RegisterValues) => {
    // Тут буде логіка Supabase/Python
    console.log("Реєстрація:", data);
  };

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                  placeholder="New"
                  className={
                    form.formState.errors.firstName
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {form.formState.errors.firstName && (
                  <span className="text-[10px] font-bold text-red-500 uppercase">
                    {form.formState.errors.firstName.message}
                  </span>
                )}
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
                  placeholder="Neighbour"
                  className={
                    form.formState.errors.lastName
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {form.formState.errors.lastName && (
                  <span className="text-[10px] font-bold text-red-500 uppercase">
                    {form.formState.errors.lastName.message}
                  </span>
                )}
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
                placeholder="cool_neighbour"
                className={
                  form.formState.errors.username
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {form.formState.errors.username && (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.username.message}
                </span>
              )}
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
                placeholder="newneighbour@gmail.com"
                className={
                  form.formState.errors.email
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {form.formState.errors.email && (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.email.message}
                </span>
              )}
            </div>

            <div className="grid gap-1">
              <Label
                htmlFor="password"
                className={
                  form.formState.errors.password
                    ? "text-red-500"
                    : "text-slate-700"
                }
              >
                Пароль
              </Label>
              <div className="relative">
                <Input
                  {...form.register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`pr-10 ${form.formState.errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.formState.errors.password && (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.password.message}
                </span>
              )}
            </div>

            {/* ПІДТВЕРДЖЕННЯ З ОКОМ */}
            <div className="grid gap-1">
              <Label
                htmlFor="confirmPassword"
                className={
                  form.formState.errors.confirmPassword
                    ? "text-red-500"
                    : "text-slate-700"
                }
              >
                Підтвердження
              </Label>
              <div className="relative">
                <Input
                  {...form.register("confirmPassword")}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`pr-10 ${form.formState.errors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <span className="text-[10px] font-bold text-red-500 uppercase">
                  {form.formState.errors.confirmPassword.message}
                </span>
              )}
            </div>

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 transition-all active:scale-[0.98]"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Зареєструватися"
              )}
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

          <Button
            variant="outline"
            type="button"
            className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex gap-2 h-11"
          >
            <Image src="/google-icon.svg" alt="Google" width={18} height={18} />
            Google
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center pb-8">
          <div className="text-sm text-slate-500 font-medium">
            Вже маєте акаунт?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-bold hover:underline"
            >
              Увійти
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
