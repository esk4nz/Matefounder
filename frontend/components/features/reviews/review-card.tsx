"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star, Trash2, UserRound } from "lucide-react";

import { deleteReviewAction, type ReviewListItem } from "@/app/actions/reviews";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  review: ReviewListItem;
  currentUserId: string | null;
};

function authorDisplayName(review: ReviewListItem): string {
  const a = review.author;
  if (!a) {
    return "Користувач";
  }
  const parts = [a.first_name?.trim(), a.last_name?.trim()].filter(Boolean);
  if (parts.length === 0) {
    return "Користувач";
  }
  return parts.join(" ");
}

function formatReviewDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("uk-UA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "";
  }
}

export function ReviewCard({ review, currentUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isOwn = currentUserId !== null && review.author_id === currentUserId;
  const name = authorDisplayName(review);
  const avatarUrl = review.author?.avatarUrl ?? null;
  const profileReviewsHref = `/profile/${review.author_id}/reviews`;

  const handleDelete = () => {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteReviewAction(review.id, review.updated_at);
      if (res.ok) {
        setDeleteOpen(false);
        router.refresh();
        return;
      }
      setDeleteError(res.message);
    });
  };

  return (
    <>
      <Card className="border border-slate-200/90 bg-white shadow-sm">
        <CardContent className="flex gap-4 p-4 sm:p-5">
          <Link
            href={profileReviewsHref}
            className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label={`Профіль: ${name}`}
          >
            <div className="flex size-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:size-14">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="size-6 text-slate-400" />
              )}
            </div>
          </Link>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 pr-1">
                <Link
                  href={profileReviewsHref}
                  className="inline-block max-w-full truncate font-bold text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {name}
                </Link>
                <p className="text-xs font-medium text-slate-500">{formatReviewDate(review.created_at)}</p>
              </div>

              <div className="relative z-10 flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-0.5 text-amber-400" aria-label={`Оцінка ${review.rating} з 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-4 sm:size-[18px]",
                        i < review.rating ? "fill-current" : "text-slate-200",
                      )}
                      strokeWidth={1.25}
                    />
                  ))}
                </div>

                {isOwn ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                    aria-label="Видалити відгук"
                    onClick={() => {
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                ) : null}
              </div>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{review.comment}</p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити відгук?</AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію неможливо скасувати. Відгук зникне з профілю назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="px-6 text-sm font-medium text-red-600" role="alert">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Скасувати</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Видалення..." : "Видалити"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
