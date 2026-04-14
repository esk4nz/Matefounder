import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <section className="container mx-auto px-6 flex-1 flex flex-col justify-between py-12">
      <div className="flex flex-col items-center text-center mt-12 md:mt-20 gap-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-600 border border-blue-100 uppercase tracking-widest">
          <Sparkles className="h-3 w-3" /> AI-Powered Matchmaking
        </span>

        <h1 className="text-4xl font-black leading-[1.05] tracking-tighter md:text-6xl lg:text-8xl text-slate-900">
          Твій комфорт <br />
          <span className="text-blue-600">починається тут</span>
        </h1>

        <p className="max-w-[650px] text-lg text-slate-500 sm:text-xl font-medium">
          Найрозумніший спосіб знайти сусіда по дому.
        </p>

        <div className="flex flex-col sm:flex-row gap-5 mt-4">
          {/* Велика синя кнопка-посилання */}
          <Link
            href="/listings"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 h-14 px-10 rounded-2xl text-lg font-bold text-white shadow-none transition-all",
            )}
          >
            Знайти сусіда <ChevronRight className="ml-2 h-5 w-5" />
          </Link>

          {/* Контурна кнопка-посилання */}
          <Link
            href="/how-it-works"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-14 px-10 rounded-2xl border-slate-200 text-lg font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors",
            )}
          >
            Про технологію
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-blue-100 pt-12 mt-12">
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-lg">Точний аналіз</h3>
          <p className="text-sm text-slate-500 font-medium">
            Використовуємо NLP для аналізу ваших відповідей.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-lg">Безпека даних</h3>
          <p className="text-sm text-slate-500 font-medium">
            Ваші профілі захищені, а спілкування анонімне.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-lg">Смарт-фільтри</h3>
          <p className="text-sm text-slate-500 font-medium">
            Відсортуйте кандидатів за бюджетом чи районом.
          </p>
        </div>
      </div>
    </section>
  );
}
