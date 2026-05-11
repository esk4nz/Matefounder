"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AcceptedContactsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string | null;
  telegram: string | null;
  email: string | null;
};

export function AcceptedContactsDialog({
  open,
  onOpenChange,
  phone,
  telegram,
  email,
}: AcceptedContactsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Контакти</DialogTitle>
        </DialogHeader>
        <dl className="grid gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Телефон</dt>
            <dd className="mt-1 font-medium text-slate-900">{phone?.trim() ? phone : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Telegram</dt>
            <dd className="mt-1 font-medium text-slate-900">{telegram?.trim() ? telegram : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Email</dt>
            <dd className="mt-1 break-all font-medium text-slate-900">{email?.trim() ? email : "—"}</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
