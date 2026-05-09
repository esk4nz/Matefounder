"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  type AdminInterestTagRow,
  createInterestTagAction,
  deleteInterestTagAction,
  listInterestTagsAction,
  updateInterestTagAction,
} from "@/app/actions/admin";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isNextRedirectFromAction } from "@/lib/next-action-redirect";

const SEARCH_DEBOUNCE_MS = 320;

const trimmedLabelUkSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, "Назва не може бути пустою"));

const adminInterestCreateSchema = z.object({
  labelUk: trimmedLabelUkSchema,
  slug: z.string(),
});

const adminInterestEditSchema = z.object({
  labelUk: trimmedLabelUkSchema,
});

type AdminInterestCreateValues = z.infer<typeof adminInterestCreateSchema>;
type AdminInterestEditValues = z.infer<typeof adminInterestEditSchema>;

type AdminTagsTabProps = {
  initialTags: AdminInterestTagRow[];
  initialListError: string | null;
};

function formatTagUpdatedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString("uk-UA", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function AdminTagsTab({ initialTags, initialListError }: AdminTagsTabProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tags, setTags] = useState<AdminInterestTagRow[]>(initialTags);
  const [loadError, setLoadError] = useState<string | null>(initialListError);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const skipInitialEmptyFetch = useRef(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createServerError, setCreateServerError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTag, setEditTag] = useState<AdminInterestTagRow | null>(null);
  const [editServerError, setEditServerError] = useState<string | null>(null);

  const [deleteTag, setDeleteTag] = useState<AdminInterestTagRow | null>(null);
  const [deleteServerError, setDeleteServerError] = useState<string | null>(null);

  const createForm = useForm<AdminInterestCreateValues>({
    resolver: zodResolver(adminInterestCreateSchema),
    defaultValues: { labelUk: "", slug: "" },
    mode: "onSubmit",
  });

  const editForm = useForm<AdminInterestEditValues>({
    resolver: zodResolver(adminInterestEditSchema),
    defaultValues: { labelUk: "" },
    mode: "onSubmit",
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchTags = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);
    try {
      const result = await listInterestTagsAction(
        debouncedQuery.length > 0 ? debouncedQuery : undefined,
      );
      if (result.ok) {
        setTags(result.tags);
      } else {
        setLoadError(result.message);
      }
    } catch (e) {
      if (isNextRedirectFromAction(e)) {
        throw e;
      }
      setLoadError("Не вдалося завантажити список інтересів.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (skipInitialEmptyFetch.current && debouncedQuery === "") {
      skipInitialEmptyFetch.current = false;
      return;
    }
    skipInitialEmptyFetch.current = false;
    void fetchTags();
  }, [debouncedQuery, fetchTags]);

  function runMutation(
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    options?: {
      onSuccess?: () => void;
      setServerError?: (message: string | null) => void;
    },
  ) {
    options?.setServerError?.(null);
    setPendingKey(key);
    startTransition(() => {
      void (async () => {
        try {
          const result = await action();
          setPendingKey(null);
          if (!result.ok) {
            options?.setServerError?.(result.message);
            return;
          }
          options?.setServerError?.(null);
          options?.onSuccess?.();
          await fetchTags();
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

  function openEdit(tag: AdminInterestTagRow) {
    setEditServerError(null);
    editForm.reset({ labelUk: tag.labelUk });
    setEditTag(tag);
    setEditOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    createForm.reset({ labelUk: "", slug: "" });
    setCreateServerError(null);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditTag(null);
    editForm.reset({ labelUk: "" });
    setEditServerError(null);
  }

  const onCreateSubmit = createForm.handleSubmit((values) => {
    const slugArg = values.slug.trim() ? values.slug.trim() : undefined;
    runMutation(
      "create",
      () => createInterestTagAction(values.labelUk, slugArg),
      {
        onSuccess: () => closeCreate(),
        setServerError: setCreateServerError,
      },
    );
  });

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (!editTag) {
      return;
    }
    const id = editTag.id;
    const version = editTag.updatedAt;
    runMutation(
      `edit:${id}`,
      () => updateInterestTagAction(id, values.labelUk, version),
      {
        onSuccess: () => closeEdit(),
        setServerError: setEditServerError,
      },
    );
  });

  function confirmDelete() {
    if (!deleteTag) {
      return;
    }
    const id = deleteTag.id;
    const version = deleteTag.updatedAt;
    runMutation(`delete:${id}`, () => deleteInterestTagAction(id, version), {
      onSuccess: () => setDeleteTag(null),
      setServerError: setDeleteServerError,
    });
  }

  const emptyTableMessage =
    debouncedQuery.length > 0 ? "За цим запитом нічого не знайдено" : "Інтересів поки немає";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пошук за назвою тега</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="admin-interest-search"
              type="search"
              autoComplete="off"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            onClick={() => {
              createForm.reset({ labelUk: "", slug: "" });
              setCreateServerError(null);
              setCreateOpen(true);
            }}
          >
            Додати інтерес
          </Button>
        </div>

        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="max-h-[min(70vh,36rem)] overflow-x-auto overflow-y-auto rounded-xl border border-border ring-1 ring-foreground/10">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Назва
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Технічна назва
                </th>
                <th className="px-3 py-3 font-medium text-foreground" scope="col">
                  Останнє оновлення
                </th>
                <th className="px-3 py-3 text-center font-medium text-foreground" scope="col">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                    Завантаження…
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                    {emptyTableMessage}
                  </td>
                </tr>
              ) : (
                tags.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 align-middle font-medium text-foreground">
                      {t.labelUk}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 align-middle font-mono text-xs text-muted-foreground">
                      {t.slug}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle text-muted-foreground">
                      {formatTagUpdatedAt(t.updatedAt)}
                    </td>
                    <td className="min-w-[180px] px-3 py-2 align-middle">
                      <div className="flex flex-row flex-nowrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => openEdit(t)}
                        >
                          Редагувати
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => {
                            setDeleteServerError(null);
                            setDeleteTag(t);
                          }}
                        >
                          Видалити
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeCreate();
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Новий інтерес</DialogTitle>
            <DialogDescription>
              Назва відображається користувачам. Технічну назву можна залишити порожньою — тоді
              вона згенерується автоматично.
            </DialogDescription>
          </DialogHeader>
          <form
            id="admin-interest-create-form"
            className="grid gap-4 py-1"
            onSubmit={onCreateSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="interest-label-create">Назва українською</Label>
              <Input
                id="interest-label-create"
                autoComplete="off"
                aria-invalid={!!createForm.formState.errors.labelUk}
                {...createForm.register("labelUk")}
              />
              {createForm.formState.errors.labelUk ? (
                <p className="text-sm text-destructive" role="alert">
                  {createForm.formState.errors.labelUk.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="interest-slug-create">Технічна назва (slug), необов&apos;язково</Label>
              <Input
                id="interest-slug-create"
                autoComplete="off"
                className="font-mono text-xs"
                placeholder="int_custom"
                {...createForm.register("slug")}
              />
            </div>
          </form>
          {createServerError ? (
            <p className="text-sm text-destructive" role="alert">
              {createServerError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeCreate()}>
              Скасувати
            </Button>
            <Button
              type="submit"
              form="admin-interest-create-form"
              disabled={isPending && pendingKey === "create"}
            >
              {pendingKey === "create" ? "…" : "Зберегти"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEdit();
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Редагувати інтерес</DialogTitle>
            <DialogDescription>
              Змініть відображувану назву. Технічний slug не змінюється.
            </DialogDescription>
          </DialogHeader>
          <form
            id="admin-interest-edit-form"
            className="grid gap-4 py-1"
            onSubmit={onEditSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="interest-label-edit">Назва українською</Label>
              <Input
                id="interest-label-edit"
                autoComplete="off"
                aria-invalid={!!editForm.formState.errors.labelUk}
                {...editForm.register("labelUk")}
              />
              {editForm.formState.errors.labelUk ? (
                <p className="text-sm text-destructive" role="alert">
                  {editForm.formState.errors.labelUk.message}
                </p>
              ) : null}
            </div>
          </form>
          {editServerError ? (
            <p className="text-sm text-destructive" role="alert">
              {editServerError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeEdit()}>
              Скасувати
            </Button>
            <Button
              type="submit"
              form="admin-interest-edit-form"
              disabled={
                isPending && editTag != null && pendingKey === `edit:${editTag.id}`
              }
            >
              {editTag != null && pendingKey === `edit:${editTag.id}` ? "…" : "Зберегти"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTag != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTag(null);
            setDeleteServerError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити інтерес?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTag ? (
                <>
                  Буде видалено тег «{deleteTag.labelUk}». Цю дію неможливо скасувати; зв&apos;язки з
                  профілями також зникнуть.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteServerError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteServerError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleteTag != null && isPending && pendingKey === `delete:${deleteTag.id}`
              }
              onClick={confirmDelete}
            >
              {deleteTag != null && pendingKey === `delete:${deleteTag.id}` ? "…" : "Видалити"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
