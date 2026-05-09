"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";

import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "@/components/ui/carousel";
import { registerListingPhotoLightboxLayerMounted } from "@/lib/listings/listing-photo-lightbox";
import { Button } from "@/components/ui/button";

const SLIDE_FRAME_CLASS =
  "flex h-[300px] w-full shrink-0 items-center justify-center bg-muted/30 dark:bg-zinc-950 sm:h-[400px]";

const LIGHTBOX_IMG_CLASS =
  "pointer-events-none max-h-[min(92dvh,92vh)] max-w-[min(96vw,100vw)] h-auto w-auto select-none object-contain";

function CarouselSlideIndicator({ total }: { total: number }) {
  const { selectedIndex, scrollSnapListLength } = useCarousel();
  const safeIndex = Number.isFinite(selectedIndex) ? selectedIndex : 0;
  const denom = scrollSnapListLength > 0 ? scrollSnapListLength : total;
  const current = Math.min(Math.max(safeIndex + 1, 1), Math.max(denom, 1));
  return (
    <div
      className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-medium text-white tabular-nums"
      aria-live="polite"
    >
      <span className="sr-only">
        Фото {current} з {denom}
      </span>
      <span aria-hidden>
        {current}/{denom}
      </span>
    </div>
  );
}

type PhotoLightboxProps = {
  urls: readonly string[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
};

function PhotoLightbox({ urls, index, onClose, onNavigate }: PhotoLightboxProps) {
  const count = urls.length;
  const hasNav = count > 1;
  const url = urls[index];

  useEffect(() => {
    return registerListingPhotoLightboxLayerMounted();
  }, []);

  const goPrev = useCallback(() => {
    onNavigate((index - 1 + count) % count);
  }, [count, index, onNavigate]);

  const goNext = useCallback(() => {
    onNavigate((index + 1) % count);
  }, [count, index, onNavigate]);

  useEffect(() => {
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (hasNav && e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        goPrev();
        return;
      }
      if (hasNav && e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        goNext();
      }
    };
    document.addEventListener("keydown", onKeyCapture, true);
    return () => document.removeEventListener("keydown", onKeyCapture, true);
  }, [goNext, goPrev, hasNav, onClose]);

  return (
    <div
      data-listing-photo-lightbox-root=""
      className="fixed inset-0 z-[100] flex flex-col bg-black/93"
      role="dialog"
      aria-modal="true"
      aria-label="Перегляд фото"
    >
      <div className="relative z-30 flex shrink-0 items-center justify-end gap-2 px-3 py-3 sm:px-4">
        {hasNav ? (
          <span className="mr-auto text-xs tabular-nums text-white/80 sm:text-sm">
            {index + 1} / {count}
          </span>
        ) : (
          <span className="mr-auto" />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/15 hover:text-white"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          aria-label="Закрити перегляд фото"
        >
          <XIcon className="size-5" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-zoom-out border-0 bg-transparent p-0"
          aria-label="Закрити перегляд фото"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-12 pb-10 pt-2 sm:px-16">
          {hasNav ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="pointer-events-auto absolute top-1/2 left-1 z-30 size-11 shrink-0 -translate-y-1/2 rounded-full border border-white/25 bg-black/55 text-white hover:bg-black/70"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Попереднє фото"
            >
              <ChevronLeftIcon className="size-6" />
            </Button>
          ) : null}

          <button
            type="button"
            className="pointer-events-auto relative z-20 flex max-h-full max-w-full cursor-zoom-out touch-manipulation items-center justify-center rounded-lg border-0 bg-transparent p-2 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Закрити перегляд фото"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          >
            <img
              src={url}
              alt=""
              className={LIGHTBOX_IMG_CLASS}
              decoding="async"
              loading="eager"
            />
          </button>

          {hasNav ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="pointer-events-auto absolute top-1/2 right-1 z-30 size-11 shrink-0 -translate-y-1/2 rounded-full border border-white/25 bg-black/55 text-white hover:bg-black/70"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goNext();
              }}
              aria-label="Наступне фото"
            >
              <ChevronRightIcon className="size-6" />
            </Button>
          ) : null}
        </div>
      </div>

    </div>
  );
}

type ListingPhotoCarouselProps = {
  imageUrls: readonly string[];
};

export const ListingPhotoCarousel = memo(function ListingPhotoCarousel({
  imageUrls,
}: ListingPhotoCarouselProps) {
  const count = imageUrls.length;
  const showNav = count > 1;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const previewApiRef = useRef<CarouselApi | null>(null);
  const lightboxIdxRef = useRef(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (lightboxIndex !== null) {
      lightboxIdxRef.current = lightboxIndex;
    }
  }, [lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxIndex]);

  const syncPreviewToLightboxIndex = useCallback((idx: number) => {
    const api = previewApiRef.current;
    if (!api) {
      return;
    }
    requestAnimationFrame(() => {
      api.scrollTo(idx);
    });
  }, []);

  const closeLightbox = useCallback(() => {
    const idx = lightboxIdxRef.current;
    setLightboxIndex(null);
    syncPreviewToLightboxIndex(idx);
  }, [syncPreviewToLightboxIndex]);

  const navigateLightbox = useCallback((next: number) => {
    lightboxIdxRef.current = next;
    setLightboxIndex(next);
    syncPreviewToLightboxIndex(next);
  }, [syncPreviewToLightboxIndex]);

  if (count === 0) {
    return (
      <div
        className={`${SLIDE_FRAME_CLASS} rounded-xl text-sm text-muted-foreground ring-1 ring-border`}
      >
        Фото відсутнє
      </div>
    );
  }

  return (
    <>
      <Carousel
        className="relative w-full"
        setApi={(api) => {
          previewApiRef.current = api;
        }}
        opts={{
          loop: showNav,
          align: "start",
        }}
      >
        <div className="min-h-0 overflow-hidden rounded-xl ring-1 ring-border">
          <CarouselContent className="ml-0">
            {imageUrls.map((url, idx) => (
              <CarouselItem key={`${idx}-${url}`} className="basis-full pl-0">
                <div className={SLIDE_FRAME_CLASS}>
                  <button
                    type="button"
                    className="flex h-full w-full cursor-zoom-in items-center justify-center bg-transparent p-0"
                    aria-label="Відкрити фото у повному розмірі"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      lightboxIdxRef.current = idx;
                      setLightboxIndex(idx);
                      syncPreviewToLightboxIndex(idx);
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      className="pointer-events-none max-h-full max-w-full object-contain object-center"
                      decoding="async"
                      loading={idx === 0 ? "eager" : "lazy"}
                      draggable={false}
                    />
                  </button>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>
        {showNav ? (
          <>
            <CarouselPrevious
              className="border-white/90 bg-white"
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
            />
            <CarouselNext
              className="border-white/90 bg-white"
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
            />
            <CarouselSlideIndicator total={count} />
          </>
        ) : null}
      </Carousel>

      {mounted &&
        lightboxIndex !== null &&
        createPortal(
          <PhotoLightbox
            urls={imageUrls}
            index={lightboxIndex}
            onClose={closeLightbox}
            onNavigate={navigateLightbox}
          />,
          document.body,
        )}
    </>
  );
});
