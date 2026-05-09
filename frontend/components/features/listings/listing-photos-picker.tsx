"use client";

import { ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LISTING_MAX_PHOTOS } from "@/lib/listings/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ACCEPT_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type ListingPhotoItem = {
  id: string;
  kind: "new";
  file: File;
  previewUrl: string;
};

export type ExistingListingPhotoItem = {
  id: string;
  kind: "existing";
  imagePath: string;
  previewUrl: string;
};

export type AnyListingPhotoItem = ListingPhotoItem | ExistingListingPhotoItem;

function newPhotoItem(file: File): ListingPhotoItem {
  return {
    id: globalThis.crypto.randomUUID(),
    kind: "new",
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

type Props = {
  items: AnyListingPhotoItem[];
  onItemsChange: Dispatch<SetStateAction<AnyListingPhotoItem[]>>;
  errorMessage: string | null;
};

export function ListingPhotosPicker({ items, onItemsChange, errorMessage }: Props) {
  const photoInputId = useId();
  const [inputResetKey, setInputResetKey] = useState(0);
  const itemsRef = useRef(items);
  const [dragActive, setDragActive] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const row of itemsRef.current) {
        if (row.kind === "new") {
          URL.revokeObjectURL(row.previewUrl);
        }
      }
    };
  }, []);

  const mergeFiles = useCallback(
    (incoming: File[]) => {
      setHint(null);
      const valid: File[] = [];
      let rejectedAny = false;

      for (const file of incoming) {
        if (!ACCEPT_MIME.has(file.type)) {
          rejectedAny = true;
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejectedAny = true;
          continue;
        }
        valid.push(file);
      }

      const slotsBeforeAdd = LISTING_MAX_PHOTOS - items.length;

      onItemsChange((prev) => {
        const remainingSlots = LISTING_MAX_PHOTOS - prev.length;
        if (remainingSlots <= 0) {
          return prev;
        }

        const slice = valid.slice(0, remainingSlots);
        const additions = slice.map(newPhotoItem);
        if (additions.length === 0) {
          return prev;
        }

        return [...prev, ...additions];
      });

      if (rejectedAny) {
        setHint(
          "Деякі файли пропущено: потрібні JPG, PNG або WEBP, до 8 МБ кожен.",
        );
      } else if (slotsBeforeAdd <= 0 && valid.length > 0) {
        setHint(`Максимум ${LISTING_MAX_PHOTOS} фото. Видаліть зайві, щоб додати нові.`);
      } else if (slotsBeforeAdd > 0 && valid.length > slotsBeforeAdd) {
        setHint(`Через ліміт ${LISTING_MAX_PHOTOS} фото додані не всі обрані файли.`);
      }

      setInputResetKey((k) => k + 1);
    },
    [items.length, onItemsChange],
  );

  const removeAt = useCallback(
    (index: number) => {
      onItemsChange((prev) => {
        const row = prev[index];
        if (!row) {
          return prev;
        }
        if (row.kind === "new") {
          URL.revokeObjectURL(row.previewUrl);
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    [onItemsChange],
  );

  const move = useCallback(
    (from: number, delta: number) => {
      onItemsChange((prev) => {
        const to = from + delta;
        if (to < 0 || to >= prev.length) {
          return prev;
        }
        const next = prev.slice();
        const [row] = next.splice(from, 1);
        next.splice(to, 0, row);
        return next;
      });
    },
    [onItemsChange],
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="grid gap-1">
        <Label className="text-slate-700">Фото анкети</Label>
        <p className="text-xs text-slate-500">
          Від 1 до {LISTING_MAX_PHOTOS} фото (JPG, PNG, WEBP). Перший знімок показуватиметься у списку
          першим — порядок можна змінити стрілками або передвигаючи мишкою.
        </p>
      </div>

      <div
        className={cn(
          "rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragActive ? "border-blue-500 bg-blue-50/80" : "border-slate-300 bg-white/70",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragActive(false);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const dropped = Array.from(e.dataTransfer.files ?? []);
          mergeFiles(dropped);
        }}
      >
        <p className="text-sm font-semibold text-slate-800">
          Перетягніть фото сюди або оберіть файли
        </p>
        <div className="mt-4 flex justify-center">
          <Label
            htmlFor={photoInputId}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Upload className="size-4" aria-hidden />
            Обрати фото
          </Label>
          <input
            key={inputResetKey}
            id={photoInputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            multiple
            className="sr-only"
            onChange={(event) => {
              const list = event.target.files ? Array.from(event.target.files) : [];
              mergeFiles(list);
            }}
          />
        </div>
      </div>

      {hint ? (
        <p className="text-xs font-semibold text-amber-800" role="status">
          {hint}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                "relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
                dragIndex === index && "opacity-70 ring-2 ring-blue-400",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex === null || dragIndex === index) return;
                const from = dragIndex;
                const to = index;
                onItemsChange((prev) => {
                  const next = prev.slice();
                  const [row] = next.splice(from, 1);
                  next.splice(to, 0, row);
                  return next;
                });
                setDragIndex(null);
              }}
            >
              <div
                className="aspect-square w-full cursor-grab bg-slate-100 active:cursor-grabbing"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
              >
                <img src={item.previewUrl} alt="" draggable={false} className="h-full w-full object-cover" />
              </div>
              <p
                className="truncate px-2 py-1 text-[10px] font-medium text-slate-600"
                title={item.kind === "new" ? item.file.name : "Збережене фото"}
              >
                {item.kind === "new" ? item.file.name : "Збережене фото"}
              </p>
              <div className="flex items-center justify-between gap-1 border-t border-slate-100 px-1 py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 shrink-0 cursor-pointer"
                  disabled={index === 0}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => move(index, -1)}
                  aria-label="Перемістити ліворуч"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 shrink-0 cursor-pointer"
                  disabled={index === items.length - 1}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => move(index, 1)}
                  aria-label="Перемістити праворуч"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 shrink-0 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeAt(index)}
                  aria-label="Прибрати фото"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-slate-500">Фото ще не додані</p>
      )}

      <p className="text-xs text-slate-500">Додано: {items.length} / {LISTING_MAX_PHOTOS}</p>

      {errorMessage ? (
        <p className="text-[10px] font-bold uppercase tracking-tight text-red-500" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
