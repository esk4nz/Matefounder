"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Star } from "lucide-react";
import { z } from "zod";

import { upsertReviewAction, type ExistingReviewSummary } from "@/app/actions/reviews";
import { FieldError } from "@/components/features/profile/profile-form-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const reviewFormSchema = z.object({
  rating: z.number().int().min(1, "Оберіть оцінку від 1 до 5.").max(5, "Оберіть оцінку від 1 до 5."),
  comment: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "Коментар не може бути порожнім.")
        .max(1000, "Максимум 1000 символів"),
    ),
});

type ReviewFormValues = z.input<typeof reviewFormSchema>;

type Props = {
  targetUserId: string;
  existingReview: ExistingReviewSummary | null;
};

export function ReviewForm({ targetUserId, existingReview }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const defaultValues = useMemo(
    () => ({
      rating: existingReview?.rating ?? 0,
      comment: existingReview?.comment ?? "",
    }),
    [existingReview?.comment, existingReview?.rating],
  );

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    form.clearErrors("root");
    startTransition(async () => {
      const res = await upsertReviewAction(
        targetUserId,
        values.rating,
        values.comment,
        existingReview?.updated_at,
      );
      if (res.ok) {
        router.refresh();
        return;
      }
      form.setError("root", { message: res.message });
    });
  });

  const ratingValue = form.watch("rating");

  return (
    <Card
      id="review-form-panel"
      className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-blue-100/90"
    >
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl font-bold text-slate-900">
          {existingReview ? "Редагувати відгук" : "Залишити відгук"}
        </CardTitle>
        <CardDescription className="text-slate-600">
          Оцінка та коментар будуть видимі для інших користувачів після збереження.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-6" onSubmit={onSubmit} noValidate>
          <div className="grid gap-2">
            <Label className={form.formState.errors.rating ? "text-red-600" : "text-slate-800"}>
              Оцінка
            </Label>
            <Controller
              control={form.control}
              name="rating"
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-label="Оцінка зірками"
                  className="flex flex-wrap items-center gap-2"
                >
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = field.value >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        className={cn(
                          "rounded-xl p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                          active ? "text-amber-400" : "text-slate-300 hover:text-amber-200",
                        )}
                        aria-label={`${star} з 5`}
                        aria-pressed={active}
                        onClick={() => {
                          field.onChange(star);
                        }}
                      >
                        <Star
                          className={cn("size-9 sm:size-10", active ? "fill-current" : "")}
                          strokeWidth={1.5}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {form.formState.errors.rating?.message ? (
              <p className="text-sm font-medium text-red-600">{form.formState.errors.rating.message}</p>
            ) : ratingValue > 0 ? (
              <p className="text-xs font-medium text-slate-500">Обрано: {ratingValue} з 5</p>
            ) : (
              <p className="text-xs font-medium text-slate-500">Натисніть на зірки, щоб обрати оцінку.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="review-comment"
              className={form.formState.errors.comment ? "text-red-600" : "text-slate-800"}
            >
              Коментар
            </Label>
            <Controller
              control={form.control}
              name="comment"
              render={({ field }) => (
                <Textarea
                  {...field}
                  id="review-comment"
                  rows={5}
                  placeholder="Розкажіть про досвід спілкування або співпраці."
                  className={cn(
                    "min-h-32 resize-y",
                    form.formState.errors.comment ? "border-red-500 focus-visible:ring-red-500" : "",
                  )}
                />
              )}
            />
            <p className="text-xs text-slate-500">Максимум 1000 символів.</p>
            <FieldError message={form.formState.errors.comment?.message} />
          </div>

          {form.formState.errors.root?.message ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            {existingReview ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="h-11 min-w-32 cursor-pointer font-semibold"
                onClick={() => {
                  form.clearErrors("root");
                  form.reset({
                    rating: existingReview.rating,
                    comment: existingReview.comment,
                  });
                }}
              >
                Скасувати
              </Button>
            ) : null}
            <Button type="submit" disabled={pending} className="h-11 min-w-40 cursor-pointer font-bold">
              {pending ? "Збереження..." : existingReview ? "Оновити відгук" : "Надіслати відгук"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
