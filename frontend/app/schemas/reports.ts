import { z } from "zod";

export const createReportPayloadSchema = z.object({
  targetUserId: z.string().uuid("Некоректний ідентифікатор користувача."),
  targetReviewId: z.number().int().positive().optional(),
  targetListingId: z.string().uuid("Некоректний ідентифікатор оголошення.").optional(),
  reason: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(10, "Опишіть ситуацію щонайменше у 10 символах.")
        .max(500, "Текст скарги не може перевищувати 500 символів."),
    ),
});

export type CreateReportPayload = z.infer<typeof createReportPayloadSchema>;
