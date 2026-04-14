"use client";

import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginValues } from "@/app/schemas/auth";
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

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginValues) => {
    console.log("Submit:", data);
  };

  return (
    /* Прибираємо min-h-screen, бо main у layout вже має flex-1 */
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label
                htmlFor="identifier"
                className={
                  form.formState.errors.identifier
                    ? "text-red-500"
                    : "text-slate-700"
                }
              >
                Email або Логін
              </Label>
              <Input
                {...form.register("identifier")}
                id="identifier"
                type="text"
                placeholder="newneighbour@gmail.com"
                className={`bg-white border-slate-300 text-slate-900 focus:ring-blue-600 focus:border-blue-600 ${
                  form.formState.errors.identifier
                    ? "border-red-500 focus:ring-red-500"
                    : ""
                }`}
              />
              {form.formState.errors.identifier && (
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
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
                <Link
                  href="#"
                  className="ml-auto inline-block text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  Забули пароль?
                </Link>
              </div>
              <div className="relative">
                <Input
                  {...form.register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"} // Зміна типу інпуту
                  placeholder="********"
                  className={`bg-white border-slate-300 text-slate-900 focus:ring-blue-600 focus:border-blue-600 pr-10 ${
                    form.formState.errors.password
                      ? "border-red-500 focus:ring-red-500"
                      : ""
                  }`}
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
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-sm transition-colors active:scale-[0.98]"
            >
              {form.formState.isSubmitting ? (
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

          <Button
            variant="outline"
            type="button"
            className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex gap-2 h-11 shadow-sm"
          >
            <Image src="/google-icon.svg" alt="Google" width={18} height={18} />
            Google
          </Button>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-center pb-8">
          <div className="text-sm text-slate-500 font-medium">
            Немає акаунту?{" "}
            <Link
              href="/signup"
              className="text-blue-600 hover:text-blue-700 font-bold underline-offset-4 hover:underline"
            >
              Зареєструватися
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
