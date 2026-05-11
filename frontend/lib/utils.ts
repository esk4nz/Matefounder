import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const PAGE_SHELL_CLASS =
  "mx-auto w-full max-w-[1440px] px-6 py-12"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
