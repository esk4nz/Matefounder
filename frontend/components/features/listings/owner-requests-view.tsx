"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getIncomingRequestsAction } from "@/app/actions/listings";
import { AcceptedContactsDialog } from "@/components/features/listings/accepted-contacts-dialog";
import { OwnerIncomingRequestRow } from "@/components/features/listings/owner-incoming-request-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OwnerIncomingRequestItem } from "@/lib/listings/owner-incoming-request-types";
import { isNextRedirectFromAction } from "@/lib/next-action-redirect";

function tabBlocked(request: OwnerIncomingRequestItem) {
  return request.iBlockedSeeker;
}

function tabAccepted(request: OwnerIncomingRequestItem) {
  return request.status === "accepted" && !request.iBlockedSeeker;
}

function tabPending(request: OwnerIncomingRequestItem) {
  return request.status === "pending" && !request.iBlockedSeeker;
}

function tabRejected(request: OwnerIncomingRequestItem) {
  return request.status === "rejected" && !request.iBlockedSeeker;
}

function matchesOwnerRequestSearch(request: OwnerIncomingRequestItem, queryLower: string) {
  if (!queryLower) {
    return true;
  }
  const blob = [request.seekerFirstName, request.seekerLastName ?? ""]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return blob.includes(queryLower);
}

const TABLE_SCROLL_WRAP_CLASS =
  "max-h-[min(70vh,36rem)] overflow-x-auto overflow-y-auto rounded-xl border border-border ring-1 ring-foreground/10";

type OwnerRequestsViewProps = {
  listingId: string;
  listingTitle: string;
  listingUpdatedAt: string;
  initialRequests: OwnerIncomingRequestItem[];
};

export function OwnerRequestsView({
  listingId,
  listingTitle,
  listingUpdatedAt,
  initialRequests,
}: OwnerRequestsViewProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState("accepted");
  const [listRefreshError, setListRefreshError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [contactsPayload, setContactsPayload] = useState<{
    phone: string | null;
    telegram: string | null;
    email: string | null;
  } | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const accepted = useMemo(() => requests.filter(tabAccepted), [requests]);
  const pending = useMemo(() => requests.filter(tabPending), [requests]);
  const rejected = useMemo(() => requests.filter(tabRejected), [requests]);
  const blocked = useMemo(() => requests.filter(tabBlocked), [requests]);

  const searchNorm = useMemo(() => searchInput.trim().toLowerCase(), [searchInput]);

  const acceptedFiltered = useMemo(
    () => accepted.filter((r) => matchesOwnerRequestSearch(r, searchNorm)),
    [accepted, searchNorm],
  );
  const pendingFiltered = useMemo(
    () => pending.filter((r) => matchesOwnerRequestSearch(r, searchNorm)),
    [pending, searchNorm],
  );
  const rejectedFiltered = useMemo(
    () => rejected.filter((r) => matchesOwnerRequestSearch(r, searchNorm)),
    [rejected, searchNorm],
  );
  const blockedFiltered = useMemo(
    () => blocked.filter((r) => matchesOwnerRequestSearch(r, searchNorm)),
    [blocked, searchNorm],
  );

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const handleOwnerActionIssue = useCallback((message: string) => {
    setSyncWarning(message);
  }, []);

  const reloadIncomingList = useCallback(async (): Promise<
    { ok: true; requests: OwnerIncomingRequestItem[] } | { ok: false }
  > => {
    setListRefreshError(null);
    try {
      const bulk = await getIncomingRequestsAction(listingId);
      if (!bulk.ok) {
        const msg =
          bulk.reason === "unauthenticated"
            ? "Сесія завершилася. Оновіть сторінку та увійдіть повторно."
            : bulk.message ?? "Не вдалося оновити список.";
        setListRefreshError(msg);
        return { ok: false };
      }
      setRequests(bulk.requests);
      return { ok: true, requests: bulk.requests };
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
      setListRefreshError("Не вдалося оновити список.");
      return { ok: false };
    }
  }, [listingId]);

  const handleAfterMutation = useCallback(async () => {
    const result = await reloadIncomingList();
    if (result.ok) {
      setSyncWarning(null);
    }
  }, [reloadIncomingList]);

  const handleTabChange = useCallback(
    (next: string) => {
      setActiveTab(next);
      void reloadIncomingList();
    },
    [reloadIncomingList],
  );

  const emptyCopy = "Тут поки нічого немає.";
  const emptySearchCopy = "Немає заявок, що відповідають пошуку.";

  const renderTableInner = (
    items: OwnerIncomingRequestItem[],
    tab: "accepted" | "pending" | "rejected" | "blocked",
    tabTotalBeforeSearch: number,
  ) => {
    if (tabTotalBeforeSearch === 0) {
      return (
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="w-14 px-3 py-3 font-medium text-foreground" scope="col">
                <span className="sr-only">Аватар</span>
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Шукач
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Відгуки
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Відповідність
              </th>
              <th className="px-3 py-3 text-center font-medium text-foreground" scope="col">
                Дії
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                {emptyCopy}
              </td>
            </tr>
          </tbody>
        </table>
      );
    }
    if (items.length === 0) {
      return (
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="w-14 px-3 py-3 font-medium text-foreground" scope="col">
                <span className="sr-only">Аватар</span>
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Шукач
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Відгуки
              </th>
              <th className="px-3 py-3 font-medium text-foreground" scope="col">
                Відповідність
              </th>
              <th className="px-3 py-3 text-center font-medium text-foreground" scope="col">
                Дії
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                {emptySearchCopy}
              </td>
            </tr>
          </tbody>
        </table>
      );
    }
    return (
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            <th className="w-14 px-3 py-3 font-medium text-foreground" scope="col">
              <span className="sr-only">Аватар</span>
            </th>
            <th className="px-3 py-3 font-medium text-foreground" scope="col">
              Шукач
            </th>
            <th className="px-3 py-3 font-medium text-foreground" scope="col">
              Відгуки
            </th>
            <th className="px-3 py-3 font-medium text-foreground" scope="col">
              Відповідність
            </th>
            <th className="px-3 py-3 text-center font-medium text-foreground" scope="col">
              Дії
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((request) => (
            <OwnerIncomingRequestRow
              key={request.requestId}
              listingId={listingId}
              listingUpdatedAt={listingUpdatedAt}
              request={request}
              tab={tab}
              onAfterMutation={handleAfterMutation}
              onOwnerActionIssue={handleOwnerActionIssue}
              onContactsReceived={(payload) => {
                setContactsPayload(payload);
                setContactsDialogOpen(true);
              }}
            />
          ))}
        </tbody>
      </table>
    );
  };

  const requestsCard = (
    <Card>
      <CardHeader>
        <CardTitle>Пошук за ім&apos;ям або прізвищем</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="owner-requests-search"
              type="search"
              autoComplete="off"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Введіть ім'я або прізвище"
              aria-label="Пошук заявок за ім'ям або прізвищем"
              className="h-10 pl-9"
            />
          </div>
        </div>

        {listRefreshError ? (
          <p className="text-sm text-destructive" role="alert">
            {listRefreshError}
          </p>
        ) : null}

        <TabsContent value="accepted" className="mt-0 outline-none">
          <div className={TABLE_SCROLL_WRAP_CLASS}>{renderTableInner(acceptedFiltered, "accepted", accepted.length)}</div>
        </TabsContent>
        <TabsContent value="pending" className="mt-0 outline-none">
          <div className={TABLE_SCROLL_WRAP_CLASS}>{renderTableInner(pendingFiltered, "pending", pending.length)}</div>
        </TabsContent>
        <TabsContent value="rejected" className="mt-0 outline-none">
          <div className={TABLE_SCROLL_WRAP_CLASS}>{renderTableInner(rejectedFiltered, "rejected", rejected.length)}</div>
        </TabsContent>
        <TabsContent value="blocked" className="mt-0 outline-none">
          <div className={TABLE_SCROLL_WRAP_CLASS}>{renderTableInner(blockedFiltered, "blocked", blocked.length)}</div>
        </TabsContent>
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full">
      <p className="text-sm font-medium text-muted-foreground">
        <Link href="/my-listings" className="text-primary underline-offset-2 hover:underline">
          Мої оголошення
        </Link>
        <span aria-hidden className="mx-2 text-muted-foreground/70">
          /
        </span>
        <span className="text-foreground">{listingTitle}</span>
      </p>
      <h1 className="mt-2 text-3xl font-black text-slate-900">Заявки</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Переглядайте заявки шукачів до цього оголошення та керуйте статусом і контактами після схвалення.
      </p>

      {syncWarning ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {syncWarning}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-8 w-full">
        <TabsList aria-label="Заявки за статусом">
          <TabsTrigger value="accepted">Схвалені ({accepted.length})</TabsTrigger>
          <TabsTrigger value="pending">Очікують ({pending.length})</TabsTrigger>
          <TabsTrigger value="rejected">Відхилені ({rejected.length})</TabsTrigger>
          <TabsTrigger value="blocked">Заблоковані ({blocked.length})</TabsTrigger>
        </TabsList>

        <div className="mt-4">{requestsCard}</div>
      </Tabs>

      <AcceptedContactsDialog
        open={contactsDialogOpen}
        onOpenChange={setContactsDialogOpen}
        phone={contactsPayload?.phone ?? null}
        telegram={contactsPayload?.telegram ?? null}
        email={contactsPayload?.email ?? null}
      />
    </div>
  );
}
