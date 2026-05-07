"use client";

import Link from "next/link";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  deleteMyListingAction,
  getMyListingFreshDataAction,
  updateMyListingStatusAction,
} from "@/app/actions/listings";
import type { ListingDetailsPayload } from "@/lib/listings/listing-details-types";
import { CreateListingCta } from "@/components/features/listings/create-listing-cta";
import { ListingDetailsModal } from "@/components/features/listings/listing-details-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MyListingCardModel = {
  id: string;
  title: string;
  type: "offering" | "searching";
  isActive: boolean;
  updatedAt: string;
  firstImageUrl: string | null;
  details: ListingDetailsPayload;
};

type MyListingsViewProps = {
  userId: string;
  listings: MyListingCardModel[];
};

const TYPE_SUBLINE: Record<MyListingCardModel["type"], string> = {
  offering: "Шукаю когось до себе у квартиру",
  searching: "Шукаю, до кого можна заселитися",
};

export function MyListingsView({ userId, listings }: MyListingsViewProps) {
  const [listingCards, setListingCards] = useState(listings);
  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const [activeListingDetails, setActiveListingDetails] = useState<ListingDetailsPayload | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [statusActionListingId, setStatusActionListingId] = useState<string | null>(null);
  const [deleteTargetListingId, setDeleteTargetListingId] = useState<string | null>(null);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [deleteServerError, setDeleteServerError] = useState<string | null>(null);
  const activeListingTitle =
    openListingId ? (listingCards.find((listing) => listing.id === openListingId)?.title ?? null) : null;
  const deleteTarget = deleteTargetListingId
    ? (listingCards.find((listing) => listing.id === deleteTargetListingId) ?? null)
    : null;

  const handleStatusToggle = async (listing: MyListingCardModel) => {
    const nextIsActive = !listing.isActive;
    setStatusActionListingId(listing.id);
    try {
      const result = await updateMyListingStatusAction(listing.id, nextIsActive, listing.updatedAt);
      if (!result.ok) {
        setSyncWarning(result.message);
        return;
      }

      setListingCards((prev) =>
        prev.map((card) =>
          card.id === listing.id
            ? { ...card, isActive: result.isActive, updatedAt: result.updatedAt }
            : card,
        ),
      );
      setSyncWarning(null);
    } catch {
      setSyncWarning("Сталася помилка під час зміни статусу. Оновіть сторінку та спробуйте ще раз.");
    } finally {
      setStatusActionListingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetListingId || !deleteTarget) {
      return;
    }

    setDeleteServerError(null);
    setIsDeletePending(true);
    try {
      const result = await deleteMyListingAction(deleteTargetListingId, deleteTarget.updatedAt);
      if (!result.ok) {
        setDeleteServerError(result.message);
        return;
      } else {
        setListingCards((prev) => prev.filter((card) => card.id !== deleteTargetListingId));
        if (openListingId === deleteTargetListingId) {
          setOpenListingId(null);
          setActiveListingDetails(null);
        }
      }
      setDeleteServerError(null);
      setDeleteTargetListingId(null);
    } catch {
      setDeleteServerError("Сталася помилка. Оновіть сторінку та спробуйте ще раз.");
    } finally {
      setIsDeletePending(false);
    }
  };

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
        const result = await getMyListingFreshDataAction(openListingId);
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          if (result.reason === "notFound") {
            setListingCards((prev) => prev.filter((card) => card.id !== openListingId));
            setOpenListingId(null);
            setActiveListingDetails(null);
            setSyncWarning("Це оголошення вже недоступне. Список оновлено.");
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
        setListingCards((prev) =>
          prev.map((card) => (card.id === result.card.id ? result.card : card)),
        );
      } catch {
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

  return (
    <section className="container mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-black text-slate-900">Мої оголошення</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Керуйте своїми оголошеннями та відстежуйте відповіді від інших користувачів.
      </p>

      <CreateListingCta />
      {syncWarning ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {syncWarning}
        </div>
      ) : null}

      {listingCards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-blue-100 bg-white/80 px-6 py-14 text-center shadow-sm">
          <p className="text-base font-medium text-slate-600">У вас поки немає активних оголошень.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listingCards.map((listing) => (
            <article
              key={listing.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="aspect-[4/3] w-full bg-slate-100">
                {listing.firstImageUrl ? (
                  <img
                    src={listing.firstImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Фото відсутнє
                  </div>
                )}
              </div>
              <div className="grid gap-3 p-4">
                <div className="grid gap-1">
                  <h2 className="line-clamp-2 text-base font-bold text-slate-900">{listing.title}</h2>
                  <p className="text-sm text-slate-600">{TYPE_SUBLINE[listing.type]}</p>
                  <span
                    className={
                      listing.isActive
                        ? "inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        : "inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                    }
                  >
                    {listing.isActive ? "Активне" : "Неактивне"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    className="h-9 px-4"
                    onClick={() => setOpenListingId(listing.id)}
                  >
                    Оглянути
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" aria-label="Меню дій">
                        <MoreHorizontal className="size-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/my-listings/${listing.id}/edit`}>Редагувати</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void handleStatusToggle(listing);
                        }}
                        disabled={statusActionListingId === listing.id || isDeletePending}
                      >
                        {listing.isActive ? "Зробити неактивним" : "Зробити активним"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
                        onClick={() => {
                          setDeleteServerError(null);
                          setDeleteTargetListingId(listing.id);
                        }}
                        disabled={isDeletePending}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Видалити
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

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
      />

      <AlertDialog
        open={Boolean(deleteTargetListingId)}
        onOpenChange={(next) => {
          if (!next && !isDeletePending) {
            setDeleteTargetListingId(null);
            setDeleteServerError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити оголошення?</AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію неможливо скасувати. Оголошення буде назавжди видалено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteServerError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteServerError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletePending || !deleteTarget}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {isDeletePending ? "Видалення..." : "Видалити"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
