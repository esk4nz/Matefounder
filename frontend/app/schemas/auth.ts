import { z } from "zod";

const personNamePartRegex = /^\p{L}+(?:['’\-]\p{L}+)*$/u;
const passwordAllowedCharactersRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;
const passwordSpecialCharacterRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const PERSON_NAME_ALLOWED_CHARACTERS_MESSAGE =
  "Може містити лише літери, апострофи та дефіси між частинами";
const PASSWORD_MIN_LENGTH_MESSAGE = "Пароль має бути не менше 8 символів";
const PASSWORD_ALLOWED_CHARACTERS_MESSAGE =
  "Пароль може містити лише латинські літери, цифри та спецсимволи";
const PASSWORD_LOWERCASE_MESSAGE = "Пароль має містити хоча б одну малу латинську літеру";
const PASSWORD_UPPERCASE_MESSAGE = "Пароль має містити хоча б одну велику латинську літеру";
const PASSWORD_SPECIAL_CHARACTER_MESSAGE =
  "Пароль має містити хоча б один спецсимвол: ! @ # $ % & * ? - _ .";
export const NEW_PASSWORD_REQUIREMENTS_HINT =
  "Мінімум 8 символів, велика і мала латинська літера та спецсимвол: ! @ # $ % & * ? - _ .";

function createPersonNameSchema(fieldLabel: string) {
  return z
    .string()
    .trim()
    .min(1, `${fieldLabel} надто коротке`)
    .regex(personNamePartRegex, {
      message: PERSON_NAME_ALLOWED_CHARACTERS_MESSAGE,
    });
}

const loginPasswordSchema = z.string().min(1, "Введіть пароль");
const newPasswordSchema = z
  .string()
  .min(1, "Введіть новий пароль")
  .min(8, PASSWORD_MIN_LENGTH_MESSAGE)
  .regex(passwordAllowedCharactersRegex, PASSWORD_ALLOWED_CHARACTERS_MESSAGE)
  .regex(/[a-z]/, PASSWORD_LOWERCASE_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_UPPERCASE_MESSAGE)
  .regex(passwordSpecialCharacterRegex, PASSWORD_SPECIAL_CHARACTER_MESSAGE);

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, { message: "Логін або пошта мають бути не менше 3 символів" }),
  password: loginPasswordSchema,
});

export const registerSchema = z
  .object({
    firstName: createPersonNameSchema("Ім'я"),
    lastName: createPersonNameSchema("Прізвище"),
    username: z
      .string()
      .min(3, "Мінімум 3 символи")
      .max(20, "Максимум 20 символів")
      .regex(/^[a-zA-Z0-9_]+$/, {
        message: "Тільки латиниця, цифри та '_'",
      }),
    email: z.string().email("Некоректна пошта"),
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "Підтвердіть пароль"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Паролі не співпадають",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
