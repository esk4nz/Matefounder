import Link from "next/link";
import { buttonVariants } from "@/components/ui/button"; // Імпортуємо функцію варіантів
import { cn } from "@/lib/utils"; // Допоміжна функція shadcn для об'єднання класів

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-blue-100 bg-[#EBF4FF]">
      <div className="container mx-auto flex min-h-[5rem] flex-wrap items-center justify-between gap-x-6 gap-y-4 px-6 py-4 md:py-0">
        <Link
          href="/"
          className="text-2xl font-black tracking-tighter text-slate-900 uppercase shrink-0"
        >
          Mate<span className="text-blue-600">founder</span>
        </Link>

        <div className="text-xl flex items-center gap-x-8 gap-y-2 font-bold text-slate-600">
          <Link
            href="/listings"
            className="hover:text-blue-600 transition-colors whitespace-nowrap"
          >
            Оголошення
          </Link>
          <Link
            href="/how-it-works"
            className="hover:text-blue-600 transition-colors whitespace-nowrap"
          >
            Як це працює
          </Link>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Кнопка "Увійти" через buttonVariants */}
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-12 px-6 rounded-xl text-xl font-bold text-slate-700 hover:text-blue-600 hover:bg-blue-100/50",
            )}
          >
            Увійти
          </Link>

          {/* Кнопка "Почати" через buttonVariants */}
          <Link
            href="/register"
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl px-6 h-12 text-xl font-bold transition-colors shadow-none",
            )}
          >
            Реєстрація
          </Link>
        </div>
      </div>
    </nav>
  );
}
