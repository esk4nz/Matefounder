import { z } from "zod";

export const REVIEWS_PAGE_SIZE = 10;

export const REVIEW_STALE_VERSION_MESSAGE =
  "Цей відгук вже було змінено в іншій вкладці. Будь ласка, оновіть сторінку.";

export const REVIEW_NOT_FOUND_MESSAGE =
  "Цей відгук не знайдено. Можливо, він вже був видалений.";

export const REVIEW_ALREADY_LEFT_MESSAGE =
  "Ви вже залишили відгук для цього користувача. Будь ласка, оновіть сторінку, щоб побачити його.";

export const REVIEW_UPDATE_RLS_INACTIVE_REQUEST_MESSAGE =
  "Ви більше не можете редагувати цей відгук. Можливо, спільна заявка на оренду була скасована.";

export const REVIEW_INSERT_RLS_INACTIVE_REQUEST_MESSAGE =
  "Не вдалося зберегти відгук. Можливо, спільна заявка на оренду була скасована.";

export const reviewTargetIdSchema = z.string().uuid("Некоректний ідентифікатор профілю.");

const reviewContentFields = {
  targetId: reviewTargetIdSchema,
  rating: z.number().int().min(1, "Оцінка від 1 до 5.").max(5, "Оцінка від 1 до 5."),
  comment: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "Коментар не може бути порожнім.")
        .max(1000, "Максимум 1000 символів"),
    ),
};

export const upsertReviewInsertPayloadSchema = z.object(reviewContentFields);

export const upsertReviewUpdatePayloadSchema = z.object({
  ...reviewContentFields,
  updatedAt: z
    .string()
    .min(1, REVIEW_STALE_VERSION_MESSAGE)
    .refine((s) => s.trim().length > 0, REVIEW_STALE_VERSION_MESSAGE),
});

export const upsertReviewPayloadSchema = z.object({
  ...reviewContentFields,
  updatedAt: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" ? v : undefined)),
});

export const deleteReviewPayloadSchema = z.object({
  reviewId: z.number().int().positive(),
  updatedAt: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, REVIEW_STALE_VERSION_MESSAGE),
  ),
});

export type UpsertReviewInsertPayload = z.infer<typeof upsertReviewInsertPayloadSchema>;
export type UpsertReviewUpdatePayload = z.infer<typeof upsertReviewUpdatePayloadSchema>;
export type UpsertReviewPayload = z.infer<typeof upsertReviewPayloadSchema>;
export type DeleteReviewPayload = z.infer<typeof deleteReviewPayloadSchema>;
