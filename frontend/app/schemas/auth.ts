import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, { message: "Логін або пошта мають бути не менше 3 символів" }),
  password: z
    .string()
    .min(8, { message: "Пароль має бути не менше 8 символів" }),
});

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(1, "Ім'я надто коротке")
      .regex(/^[a-zA-Zа-яА-ЯіІїЇєЄґҐ]+$/, {
        message: "Ім'я може містити лише букви",
      }),
    lastName: z
      .string()
      .min(1, "Прізвище надто коротке")
      .regex(/^[a-zA-Zа-яА-ЯіІїЇєЄґҐ]+$/, {
        message: "Прізвище може містити лише букви",
      }),
    username: z
      .string()
      .min(3, "Мінімум 3 символи")
      .max(20, "Максимум 20 символів")
      .regex(/^[a-zA-Z0-9_]+$/, {
        message: "Тільки латиниця, цифри та '_'",
      }),
    email: z.string().email("Некоректна пошта"),
    password: z.string().min(8, "Пароль має бути не менше 8 символів"),
    confirmPassword: z.string().min(1, "Підтвердіть пароль"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Паролі не співпадають",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
