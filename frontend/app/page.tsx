import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <section className="container mx-auto px-6 flex-1 flex flex-col justify-between py-12">
      <div className="flex flex-col items-center text-center mt-12 md:mt-24 gap-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-[10px] md:text-xs font-bold text-blue-600 border border-blue-100 uppercase tracking-widest">
          <Sparkles className="h-3 w-3" /> AI-Powered Matchmaking
        </span>

        <h1 className="text-4xl font-black leading-[1.1] tracking-tighter md:text-5xl lg:text-7xl text-slate-900">
          Твій комфорт <br />
          <span className="text-blue-600">починається тут</span>
        </h1>

        <p className="max-w-[600px] text-base text-slate-500 sm:text-lg font-medium leading-relaxed">
          Найрозумніший спосіб знайти сусіда по дому.{" "}
          <br className="hidden md:block" />
          Аналізуємо твій стиль життя, щоб знайти ідеальний метч.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Link
            href="/listings"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 h-12 px-8 rounded-xl text-base font-bold text-white shadow-lg shadow-blue-200 transition-all",
            )}
          >
            Знайти сусіда <ChevronRight className="ml-2 h-4 w-4" />
          </Link>

          <Link
            href="/how-it-works"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-12 px-8 rounded-xl border-slate-200 text-base font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors",
            )}
          >
            Про технологію
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-blue-100/50 pt-16 mt-20">
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-base md:text-lg uppercase tracking-tight">
            Точний аналіз
          </h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Використовуємо NLP для аналізу ваших відповідей та стилю життя.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-base md:text-lg uppercase tracking-tight">
            Безпека даних
          </h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Ваші профілі захищені, а перше спілкування відбувається анонімно.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-base md:text-lg uppercase tracking-tight">
            Смарт-фільтри
          </h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Швидке сортування кандидатів за бюджетом, районом чи звичками.
          </p>
        </div>
      </div>
    </section>
  );
}
