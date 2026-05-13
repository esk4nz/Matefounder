"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Controller, useForm } from "react-hook-form";

import { createReportAction } from "@/app/actions/reports";
import { createReportPayloadSchema, type CreateReportPayload } from "@/app/schemas/reports";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReportDialogProps = {
  targetUserId: string;
  targetReviewId?: number;
  targetListingId?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function ReportSuccessToast({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  useEffect(() => {
    if (!visible) {
      return;
    }
    const t = window.setTimeout(() => {
      onDismiss();
    }, 3200);
    return () => window.clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="status"
      className="pointer-events-auto fixed right-4 top-24 z-[100] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-2xl border border-emerald-100 bg-white/95 p-4 text-left shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)] ring-1 ring-emerald-50 backdrop-blur sm:right-6"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <Check className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold leading-6 text-slate-800">Скаргу надіслано модераторам</p>
      <button
        type="button"
        aria-label="Закрити повідомлення"
        onClick={onDismiss}
        className="-mr-1 -mt-1 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  );
}

export function ReportDialog({
  targetUserId,
  targetReviewId,
  targetListingId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ReportDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? Boolean(controlledOpen) : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (!isControlled) {
        setInternalOpen(next);
      }
    },
    [isControlled, onOpenChange],
  );

  const [toastVisible, setToastVisible] = useState(false);
  const dismissToast = useCallback(() => setToastVisible(false), []);
  const [pending, startTransition] = useTransition();

  const defaultValues = useMemo<CreateReportPayload>(
    () => ({
      targetUserId,
      reason: "",
      ...(targetReviewId !== undefined ? { targetReviewId } : {}),
      ...(targetListingId !== undefined ? { targetListingId } : {}),
    }),
    [targetListingId, targetReviewId, targetUserId],
  );

  const form = useForm<CreateReportPayload>({
    resolver: zodResolver(createReportPayloadSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form.reset]);

  const onSubmit = form.handleSubmit((values) => {
    form.clearErrors("root");
    startTransition(async () => {
      const res = await createReportAction(values);
      if (res.ok) {
        form.reset(defaultValues);
        setOpen(false);
        setToastVisible(true);
        return;
      }
      form.setError("root", { message: res.error });
    });
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">Поскаржитись</DialogTitle>
              <DialogDescription className="text-slate-600">
                Опишіть порушення або проблему. Модератори переглянуть звернення.
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" {...form.register("targetUserId")} />
            {targetReviewId !== undefined ? (
              <input type="hidden" {...form.register("targetReviewId", { valueAsNumber: true })} />
            ) : null}
            {targetListingId !== undefined ? (
              <input type="hidden" {...form.register("targetListingId")} />
            ) : null}

            <div className="grid gap-2 py-4">
              <Label htmlFor="report-reason" className={form.formState.errors.reason ? "text-red-600" : ""}>
                Причина скарги
              </Label>
              <Controller
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="report-reason"
                    rows={5}
                    maxLength={500}
                    placeholder=""
                    className="min-h-[120px] resize-y"
                    disabled={pending}
                    aria-invalid={Boolean(form.formState.errors.reason)}
                  />
                )}
              />
              {form.formState.errors.reason ? (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {form.formState.errors.reason.message}
                </p>
              ) : null}
              {form.formState.errors.root ? (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {form.formState.errors.root.message}
                </p>
              ) : null}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending} className="cursor-pointer">
                  Скасувати
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending} className="cursor-pointer">
                {pending ? "Надсилання…" : "Надіслати"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ReportSuccessToast visible={toastVisible} onDismiss={dismissToast} />
    </>
  );
}
