"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getMyRequestsAction,
  getPublicListingFreshDataAction,
} from "@/app/actions/listings";
import { AcceptedContactsDialog } from "@/components/features/listings/accepted-contacts-dialog";
import { ListingCard } from "@/components/features/listings/listing-card";
import { ListingDetailsModal } from "@/components/features/listings/listing-details-modal";
import { SeekerListingActions } from "@/components/features/listings/seeker-listing-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ListingCardModel } from "@/lib/listings/listing-card-types";
import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";
import { isNextRedirectFromAction } from "@/lib/next-action-redirect";

function tabAccepted(listing: ListingCardModel) {
  return listing.requestStatus === "accepted" && !listing.isBlockedByMe && !listing.isBlockedByAuthor;
}

function tabPending(listing: ListingCardModel) {
  return listing.requestStatus === "pending" && !listing.isBlockedByMe && !listing.isBlockedByAuthor;
}

function tabRejected(listing: ListingCardModel) {
  return (listing.requestStatus === "rejected" || listing.isBlockedByAuthor) && !listing.isBlockedByMe;
}

function tabBlocked(listing: ListingCardModel) {
  return listing.isBlockedByMe === true;
}

type MyRequestsViewProps = {
  userId: string;
  initialListings: ListingCardModel[];
};

export function MyRequestsView({ userId, initialListings }: MyRequestsViewProps) {
  const [listings, setListings] = useState(initialListings);
  const [activeTab, setActiveTab] = useState("accepted");
  const [listRefreshError, setListRefreshError] = useState<string | null>(null);
  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const [activeListingDetails, setActiveListingDetails] = useState<ListingDetailsPayload | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [contactsPayload, setContactsPayload] = useState<{
    phone: string | null;
    telegram: string | null;
    email: string | null;
  } | null>(null);

  const accepted = useMemo(() => listings.filter(tabAccepted), [listings]);
  const pending = useMemo(() => listings.filter(tabPending), [listings]);
  const rejected = useMemo(() => listings.filter(tabRejected), [listings]);
  const blocked = useMemo(() => listings.filter(tabBlocked), [listings]);

  const activeListingTitle =
    openListingId ? (listings.find((listing) => listing.id === openListingId)?.title ?? null) : null;
  const activeListingCard = openListingId ? (listings.find((listing) => listing.id === openListingId) ?? null) : null;

  useEffect(() => {
    setListings(initialListings);
  }, [initialListings]);

  const handleSeekerActionIssue = useCallback((message: string) => {
    setSyncWarning(message);
  }, []);

  const reloadMyRequestsList = useCallback(async (): Promise<
    { ok: true; listings: ListingCardModel[] } | { ok: false }
  > => {
    setListRefreshError(null);
    try {
      const bulk = await getMyRequestsAction();
      if (!bulk.ok) {
        const msg =
          bulk.reason === "unauthenticated"
            ? "Сесія завершилася. Оновіть сторінку та увійдіть повторно."
            : bulk.message ?? "Не вдалося оновити список.";
        setListRefreshError(msg);
        return { ok: false };
      }
      setListings(bulk.listings);
      return { ok: true, listings: bulk.listings };
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
      setListRefreshError("Не вдалося оновити список.");
      return { ok: false };
    }
  }, []);

  const refreshSeekerListing = useCallback(
    async (listingId: string) => {
      const result = await reloadMyRequestsList();
      if (!result.ok) {
        return;
      }
      const stillThere = result.listings.some((c) => c.id === listingId);
      if (openListingId === listingId && !stillThere) {
        setOpenListingId(null);
        setActiveListingDetails(null);
        return;
      }
      if (openListingId === listingId) {
        const detail = await getPublicListingFreshDataAction(listingId, { scope: "my-requests" });
        if (detail.ok) {
          setActiveListingDetails(detail.details);
        } else if (detail.reason === "notFound") {
          setOpenListingId(null);
          setActiveListingDetails(null);
          setSyncWarning("Це оголошення більше недоступне. Оновіть сторінку.");
        }
      }
    },
    [openListingId, reloadMyRequestsList],
  );

  const handleTabChange = useCallback(
    (next: string) => {
      setActiveTab(next);
      void reloadMyRequestsList();
    },
    [reloadMyRequestsList],
  );

  useEffect(() => {
    if (!openListingId) {
      setActiveListingDetails(null);
      setIsDetailsLoading(false);
      return;
    }

    setActiveListingDetails(null);
    setIsDetailsLoading(true);

    let cancelled = false;
    const loadFreshDetails = async () => {
      try {
        const result = await getPublicListingFreshDataAction(openListingId, { scope: "my-requests" });
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          if (result.reason === "notFound") {
            setListings((prev) => prev.filter((card) => card.id !== openListingId));
            setOpenListingId(null);
            setActiveListingDetails(null);
            setSyncWarning("Це оголошення більше недоступне. Список оновлено.");
          } else if (result.reason === "unauthenticated") {
            setOpenListingId(null);
            setActiveListingDetails(null);
            setSyncWarning("Сесія завершилася. Оновіть сторінку та увійдіть повторно.");
          } else {
            setSyncWarning("Не вдалося оновити дані оголошення. Спробуйте ще раз.");
          }
          return;
        }
        setSyncWarning(null);
        setActiveListingDetails(result.details);
        setListings((prev) => prev.map((card) => (card.id === result.card.id ? result.card : card)));
      } catch {
        if (!cancelled) {
          setSyncWarning("Не вдалося оновити дані оголошення. Спробуйте ще раз.");
        }
      } finally {
        if (!cancelled) {
          setIsDetailsLoading(false);
        }
      }
    };

    void loadFreshDetails();
    return () => {
      cancelled = true;
    };
  }, [openListingId]);

  const emptyCopy = "Тут поки нічого немає.";

  const renderGrid = (items: ListingCardModel[]) =>
    items.length === 0 ? (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-base font-medium text-slate-600">{emptyCopy}</p>
      </div>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onView={() => setOpenListingId(listing.id)}
            showStatusBadge={false}
            seekerActions={
              <SeekerListingActions
                listing={listing}
                onAfterMutation={refreshSeekerListing}
                onSeekerActionIssue={handleSeekerActionIssue}
                onContactsReceived={(payload) => {
                  setContactsPayload(payload);
                  setContactsDialogOpen(true);
                }}
              />
            }
          />
        ))}
      </div>
    );

  return (
    <section className="container mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-black text-slate-900">Мої заявки</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Переглядайте статус заявок до оголошень інших користувачів та керуйте контактами після схвалення.
      </p>

      {syncWarning ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {syncWarning}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-8 w-full">
        <TabsList aria-label="Заявки за статусом">
          <TabsTrigger value="accepted">Схвалені ({accepted.length})</TabsTrigger>
          <TabsTrigger value="pending">В очікуванні ({pending.length})</TabsTrigger>
          <TabsTrigger value="rejected">Відхилені ({rejected.length})</TabsTrigger>
          <TabsTrigger value="blocked">Заблоковані ({blocked.length})</TabsTrigger>
        </TabsList>

        {listRefreshError ? (
          <p className="text-sm text-destructive" role="alert">
            {listRefreshError}
          </p>
        ) : null}

        <TabsContent value="accepted">{renderGrid(accepted)}</TabsContent>
        <TabsContent value="pending">{renderGrid(pending)}</TabsContent>
        <TabsContent value="rejected">{renderGrid(rejected)}</TabsContent>
        <TabsContent value="blocked">{renderGrid(blocked)}</TabsContent>
      </Tabs>

      <ListingDetailsModal
        listing={activeListingDetails}
        fallbackTitle={activeListingTitle}
        loading={isDetailsLoading}
        open={openListingId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setOpenListingId(null);
          }
        }}
        currentUserId={userId}
        seekerFooter={
          activeListingCard ? (
            <SeekerListingActions
              variant="modal"
              listing={activeListingCard}
              onAfterMutation={refreshSeekerListing}
              onSeekerActionIssue={handleSeekerActionIssue}
              onContactsReceived={(payload) => {
                setContactsPayload(payload);
                setContactsDialogOpen(true);
              }}
            />
          ) : null
        }
      />

      <AcceptedContactsDialog
        open={contactsDialogOpen}
        onOpenChange={setContactsDialogOpen}
        phone={contactsPayload?.phone ?? null}
        telegram={contactsPayload?.telegram ?? null}
        email={contactsPayload?.email ?? null}
      />
    </section>
  );
}
