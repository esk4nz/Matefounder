"use client";

import { User as UserIcon, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  type AdminUserRow,
  grantAdminRoleAction,
  listAdminUsersAction,
  setUserBlockedAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { isNextRedirectFromAction } from "@/lib/next-action-redirect";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 320;

type AdminUsersTabProps = {
  currentUserId: string;
  initialUsers: AdminUserRow[];
  initialHasMore: boolean;
  initialListError: string | null;
};

function canModerateRow(user: AdminUserRow, currentUserId: string) {
  return user.id !== currentUserId && !user.isAdmin;
}

function UserStatusText({ user }: { user: AdminUserRow }) {
  if (user.isAdmin) {
    return <span className="font-medium text-foreground">Адміністратор</span>;
  }
  if (user.isBlocked) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">Користувач</span>
        <span className="text-xs text-destructive">Заблоковано</span>
      </div>
    );
  }
  return <span className="font-medium text-foreground">Користувач</span>;
}

export function AdminUsersTab({
  currentUserId,
  initialUsers,
  initialHasMore,
  initialListError,
}: AdminUsersTabProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadError, setLoadError] = useState<string | null>(initialListError);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const skipInitialEmptyFetch = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUsers = useCallback(async (q: string) => {
    setLoadError(null);
    setIsLoading(true);
    try {
      const result = await listAdminUsersAction(q.length > 0 ? q : undefined, {
        offset: 0,
      });
      if (result.ok) {
        setUsers(result.users);
        setHasMore(result.hasMore);
      } else {
        setLoadError(result.message);
      }
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
      setLoadError("Не вдалося завантажити список користувачів.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const result = await listAdminUsersAction(
        debouncedQuery.length > 0 ? debouncedQuery : undefined,
        { offset: users.length },
      );
      if (result.ok) {
        setUsers((prev) => [...prev, ...result.users]);
        setHasMore(result.hasMore);
      }
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, users.length]);

  useEffect(() => {
    if (skipInitialEmptyFetch.current && debouncedQuery === "") {
      skipInitialEmptyFetch.current = false;
      return;
    }
    skipInitialEmptyFetch.current = false;
    void fetchUsers(debouncedQuery);
  }, [debouncedQuery, fetchUsers]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore) {
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (
          first?.isIntersecting &&
          hasMore &&
          !isLoading &&
          !isLoadingMore
        ) {
          void loadMore();
        }
      },
      { root, rootMargin: "80px", threshold: 0 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  function runAction(
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
  ) {
    setActionError(null);
    setPendingKey(key);
    startTransition(() => {
      void (async () => {
        try {
          const result = await action();
          setPendingKey(null);
          if (!result.ok) {
            setActionError(result.message);
            return;
          }
          await fetchUsers(debouncedQuery);
        } catch (e) {
          setPendingKey(null);
          if (isNextRedirectFromAction(e)) {
            throw e;
          }
          throw e;
        }
      })();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пошук за логіном або електронною поштою</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="admin-user-search"
              type="search"
              autoComplete="off"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
        </div>

        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}

        <div
          ref={scrollRef}
          className="max-h-[min(70vh,36rem)] overflow-x-auto overflow-y-auto rounded-xl border border-border ring-1 ring-foreground/10"
        >
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="w-14 px-3 py-3 font-medium text-foreground" scope="col">
                  <span className="sr-only">Аватар</span>
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Логін
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Пошта
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Статус
                </th>
                <th className="px-3 py-3 text-center font-medium text-foreground" scope="col">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    Завантаження…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    Користувачів не знайдено
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const showActions = canModerateRow(u, currentUserId);
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 align-middle">
                        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt=""
                              className="size-9 object-cover"
                            />
                          ) : (
                            <UserIcon
                              className="size-4 text-muted-foreground"
                              aria-hidden
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle font-medium text-foreground">
                        {u.username}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 align-middle text-muted-foreground">
                        {u.email || "—"}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <UserStatusText user={u} />
                      </td>
                      <td className="min-w-[280px] px-3 py-2 align-middle">
                        {showActions ? (
                          <div className="flex flex-row flex-nowrap items-center justify-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={u.isBlocked ? "outline" : "destructive"}
                              className={cn(
                                u.isBlocked &&
                                  "border-emerald-600/45 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/45 dark:text-emerald-100 dark:hover:bg-emerald-900/55",
                              )}
                              disabled={isPending}
                              onClick={() =>
                                runAction(`block:${u.id}`, () =>
                                  setUserBlockedAction(
                                    u.id,
                                    !u.isBlocked,
                                    u.updatedAt,
                                  ),
                                )
                              }
                            >
                              {pendingKey === `block:${u.id}`
                                ? "…"
                                : u.isBlocked
                                  ? "Розбанити"
                                  : "Забанити"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              disabled={isPending}
                              onClick={() =>
                                runAction(`admin:${u.id}`, () =>
                                  grantAdminRoleAction(u.id, u.updatedAt),
                                )
                              }
                            >
                              {pendingKey === `admin:${u.id}`
                                ? "…"
                                : "Надати права адміна"}
                            </Button>
                          </div>
                        ) : (
                          <span className="block min-h-8" aria-hidden />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {hasMore ? (
            <div
              ref={sentinelRef}
              className="h-6 w-full shrink-0"
              aria-hidden
            />
          ) : null}
          {isLoadingMore ? (
            <div className="border-t border-border bg-muted/20 py-2 text-center text-xs text-muted-foreground">
              Завантаження…
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
