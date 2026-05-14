"use client";

import { FileText, User as UserIcon, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  dismissAdminReportAction,
  getAdminReportListingPreviewAction,
  listAdminReportsAction,
  resolveAdminReportBlockTargetAction,
  resolveAdminReportDeleteAndBlockAction,
  resolveAdminReportDeleteContentAction,
  type AdminReportRow,
} from "@/app/actions/admin-reports";
import { ListingDetailsModal } from "@/components/features/listings/listing-details-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isNextRedirectFromAction } from "@/lib/next-action-redirect";
import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AdminReportsTabProps = {
  currentUserId: string;
  initialReports: AdminReportRow[];
  initialHasMore: boolean;
  initialListError: string | null;
};

function formatReportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function ProfileLinkCell({
  profileId,
  username,
  avatarUrl,
}: {
  profileId: string;
  username: string;
  avatarUrl: string | null;
}) {
  return (
    <Link
      href={`/profile/${profileId}/reviews`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 max-w-[200px] items-center gap-2 text-foreground hover:underline"
    >
      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-8 object-cover" />
        ) : (
          <UserIcon className="size-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <span className="min-w-0 truncate font-medium">{username}</span>
    </Link>
  );
}

function ObjectBadge({
  label,
  onClick,
  interactive,
}: {
  label: string;
  interactive: boolean;
  onClick?: () => void;
}) {
  const cls =
    "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          cls,
          "cursor-pointer border-slate-200 bg-slate-50 text-slate-800 transition-colors hover:bg-slate-100",
        )}
      >
        {label}
      </button>
    );
  }
  return (
    <span className={cn(cls, "border-slate-200 bg-slate-50 text-slate-800")}>{label}</span>
  );
}

export function AdminReportsTab({
  currentUserId,
  initialReports,
  initialHasMore,
  initialListError,
}: AdminReportsTabProps) {
  const [reports, setReports] = useState<AdminReportRow[]>(initialReports);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadError, setLoadError] = useState<string | null>(initialListError);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<{
    comment: string;
    rating?: number;
  } | null>(null);

  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [listingDetails, setListingDetails] = useState<ListingDetailsPayload | null>(null);
  const [listingLoading, setListingLoading] = useState(false);

  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonModalText, setReasonModalText] = useState("");

  const fetchReports = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);
    try {
      const result = await listAdminReportsAction({ offset: 0 });
      if (result.ok) {
        setReports(result.reports);
        setHasMore(result.hasMore);
      } else {
        setLoadError(result.message);
      }
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
      setLoadError("Не вдалося завантажити список скарг.");
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
      const result = await listAdminReportsAction({ offset: reports.length });
      if (result.ok) {
        setReports((prev) => [...prev, ...result.reports]);
        setHasMore(result.hasMore);
      }
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoading, isLoadingMore, reports.length]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore) {
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          void loadMore();
        }
      },
      { root, rootMargin: "80px", threshold: 0 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  function runModerationAction(
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
          await fetchReports();
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

  async function openListingPreview(listingId: string) {
    setListingModalOpen(true);
    setListingLoading(true);
    setListingDetails(null);
    try {
      const result = await getAdminReportListingPreviewAction(listingId);
      if (result.ok) {
        setListingDetails(result.details);
      } else {
        setActionError(result.message);
        setListingModalOpen(false);
      }
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
      setActionError("Не вдалося завантажити оголошення.");
      setListingModalOpen(false);
    } finally {
      setListingLoading(false);
    }
  }

  function closeListingModal(open: boolean) {
    if (!open) {
      setListingModalOpen(false);
      setListingDetails(null);
      setListingLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Відкриті скарги</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Дата
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Скаржник
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  На кого скарга
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  {"Об'єкт"}
                </th>
                <th className="max-w-[220px] px-3 py-3 font-medium text-foreground" scope="col">
                  Причина
                </th>
                <th className="px-3 py-3 text-center font-medium text-foreground" scope="col">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    Завантаження…
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    Відкритих скарг немає
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const objectLabel =
                    r.objectKind === "listing"
                      ? "Оголошення"
                      : r.objectKind === "review"
                        ? "Відгук"
                        : "Профіль";
                  const showDeleteContent = r.objectKind === "listing" || r.objectKind === "review";
                  const showBlock =
                    r.target.id !== currentUserId && !r.target.isAdmin;
                  const showDeleteAndBlock = showDeleteContent && showBlock;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-muted-foreground">
                        {formatReportDate(r.createdAt)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <ProfileLinkCell
                          profileId={r.reporter.id}
                          username={r.reporter.username}
                          avatarUrl={r.reporter.avatarUrl}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <ProfileLinkCell
                          profileId={r.target.id}
                          username={r.target.username}
                          avatarUrl={r.target.avatarUrl}
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {r.objectKind === "profile" ? (
                          <ObjectBadge label={objectLabel} interactive={false} />
                        ) : null}
                        {r.objectKind === "review" ? (
                          <ObjectBadge
                            label={objectLabel}
                            interactive
                            onClick={() => {
                              if (r.review) {
                                setReviewPreview({
                                  comment: r.review.comment,
                                  rating: r.review.rating,
                                });
                              } else {
                                setReviewPreview({
                                  comment:
                                    "Текст відгуку недоступний: запис могло бути видалено раніше.",
                                });
                              }
                              setReviewOpen(true);
                            }}
                          />
                        ) : null}
                        {r.objectKind === "listing" && r.targetListingId ? (
                          <ObjectBadge
                            label={objectLabel}
                            interactive
                            onClick={() => {
                              void openListingPreview(r.targetListingId!);
                            }}
                          />
                        ) : null}
                      </td>
                      <td className="max-w-[220px] px-3 py-2 align-middle">
                        <button
                          type="button"
                          disabled={isPending}
                          className={cn(
                            "group flex w-full max-w-full min-w-0 items-center gap-1.5 rounded-md py-0.5 text-left text-sm text-muted-foreground transition-colors",
                            "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35",
                            isPending && "pointer-events-none opacity-60",
                          )}
                          aria-label="Показати повний текст причини скарги"
                          onClick={() => {
                            setReasonModalText(r.reason);
                            setReasonModalOpen(true);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{r.reason}</span>
                          <FileText
                            className="size-3.5 shrink-0 text-muted-foreground/70 group-hover:text-muted-foreground"
                            aria-hidden
                          />
                        </button>
                      </td>
                      <td className="min-w-[72px] px-3 py-2 align-middle">
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label="Дії модератора"
                                disabled={isPending}
                              >
                                <MoreHorizontal className="size-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={isPending}
                                onClick={() =>
                                  runModerationAction(`dismiss:${r.id}`, () =>
                                    dismissAdminReportAction(r.id, r.updatedAt),
                                  )
                                }
                              >
                                {pendingKey === `dismiss:${r.id}` ? "…" : "Відхилити скаргу"}
                              </DropdownMenuItem>
                              {showDeleteContent ? (
                                <DropdownMenuItem
                                  disabled={isPending}
                                  onClick={() =>
                                    runModerationAction(`del:${r.id}`, () =>
                                      resolveAdminReportDeleteContentAction(r.id, r.updatedAt),
                                    )
                                  }
                                >
                                  {pendingKey === `del:${r.id}` ? "…" : "Видалити контент"}
                                </DropdownMenuItem>
                              ) : null}
                              {showDeleteAndBlock ? (
                                <DropdownMenuItem
                                  disabled={isPending}
                                  className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
                                  onClick={() =>
                                    runModerationAction(`delblock:${r.id}`, () =>
                                      resolveAdminReportDeleteAndBlockAction(r.id, r.updatedAt),
                                    )
                                  }
                                >
                                  {pendingKey === `delblock:${r.id}`
                                    ? "…"
                                    : "Видалити контент та заблокувати"}
                                </DropdownMenuItem>
                              ) : null}
                              {showBlock ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={isPending}
                                    className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
                                    onClick={() =>
                                      runModerationAction(`block:${r.id}`, () =>
                                        resolveAdminReportBlockTargetAction(r.id, r.updatedAt),
                                      )
                                    }
                                  >
                                    {pendingKey === `block:${r.id}` ? "…" : "Заблокувати користувача"}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {hasMore ? (
            <div ref={sentinelRef} className="h-6 w-full shrink-0" aria-hidden />
          ) : null}
          {isLoadingMore ? (
            <div className="border-t border-border bg-muted/20 py-2 text-center text-xs text-muted-foreground">
              Завантаження…
            </div>
          ) : null}
        </div>
      </CardContent>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Відгук</DialogTitle>
          </DialogHeader>
          {reviewPreview ? (
            <div className="space-y-3 py-1">
              {typeof reviewPreview.rating === "number" ? (
                <p className="text-sm text-muted-foreground">
                  Оцінка:{" "}
                  <span className="font-semibold text-foreground">
                    {reviewPreview.rating} з 5
                  </span>
                </p>
              ) : null}
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {reviewPreview.comment}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={reasonModalOpen}
        onOpenChange={(open) => {
          setReasonModalOpen(open);
          if (!open) {
            setReasonModalText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Причина скарги</DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(70vh,28rem)] overflow-y-auto py-1">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {reasonModalText}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <ListingDetailsModal
        listing={listingDetails}
        loading={listingLoading}
        open={listingModalOpen}
        onOpenChange={closeListingModal}
        currentUserId={listingDetails?.creatorId ?? ""}
        seekerFooter={undefined}
      />
    </Card>
  );
}
