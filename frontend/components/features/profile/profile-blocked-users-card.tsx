"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { unblockUserAction } from "@/app/actions/blocks";
import type { BlockedUserListRow } from "@/components/features/profile/profile-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BLOCK_SYNC_NOTICE_STORAGE_KEY } from "@/lib/block-messages";

type Props = {
  initialBlockedUsers: BlockedUserListRow[];
};

function displayFullName(firstName: string, lastName: string): string {
  const a = firstName.trim();
  const b = lastName.trim();
  if (a && b) {
    return `${a} ${b}`;
  }
  return a || b || "";
}

export function ProfileBlockedUsersCard({ initialBlockedUsers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(initialBlockedUsers);
  const [pendingUnblockId, setPendingUnblockId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(BLOCK_SYNC_NOTICE_STORAGE_KEY);
      if (raw) {
        window.sessionStorage.removeItem(BLOCK_SYNC_NOTICE_STORAGE_KEY);
        queueMicrotask(() => {
          setSyncNotice(raw);
        });
      }
    } catch {
    }
  }, []);

  const handleUnblock = (targetUserId: string) => {
    setSyncNotice(null);
    setPendingUnblockId(targetUserId);
    startTransition(async () => {
      const res = await unblockUserAction(targetUserId);
      setPendingUnblockId(null);
      if (!res.ok) {
        setSyncNotice(res.error);
        return;
      }
      setList((prev) => prev.filter((u) => u.id !== targetUserId));
      router.refresh();
    });
  };

  return (
    <Card className="border-none bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-bold text-slate-900">Заблоковані користувачі</CardTitle>
        <CardDescription>
          Користувачі, яких ви приховали від себе в пошуку та списках. Розблокування повертає їх у
          звичайний режим взаємодії.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {syncNotice ? (
          <p className="text-sm text-destructive" role="alert">
            {syncNotice}
          </p>
        ) : null}

        <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-xl border border-border ring-1 ring-foreground/10">
          <Table className="min-w-[320px]">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                <TableHead scope="col" className="px-3 py-3 font-medium text-foreground">
                  Користувач
                </TableHead>
                <TableHead
                  scope="col"
                  className="px-3 py-3 text-center font-medium text-foreground"
                >
                  Дії
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={2} className="px-3 py-10 text-center text-muted-foreground">
                    У вас немає заблокованих користувачів.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((u) => {
                  const fullName = displayFullName(u.firstName, u.lastName);
                  const busy = pending && pendingUnblockId === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="px-3 py-2 align-middle">
                        <div className="flex min-w-0 max-w-[280px] items-center gap-2">
                          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="size-9 object-cover" />
                            ) : (
                              <UserRound className="size-4 text-muted-foreground" aria-hidden />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-foreground">
                              {fullName || u.username || "Користувач"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {u.username ? (
                                <Link
                                  href={`/profile/${u.id}/reviews`}
                                  className="text-foreground underline-offset-2 hover:underline"
                                >
                                  @{u.username}
                                </Link>
                              ) : (
                                <Link
                                  href={`/profile/${u.id}/reviews`}
                                  className="text-foreground underline-offset-2 hover:underline"
                                >
                                  Відгуки
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[140px] px-3 py-2 align-middle">
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            disabled={pending}
                            onClick={() => handleUnblock(u.id)}
                          >
                            {busy ? "…" : "Розблокувати"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
