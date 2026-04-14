import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-blue-200 bg-[#D8E9FF]/90 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto w-full flex min-h-[4.5rem] flex-wrap items-center justify-between gap-x-6 px-6 py-3">
        <div className="flex items-center gap-x-8 md:gap-x-12">
          <Link
            href="/"
            className="text-2xl font-black tracking-tighter text-slate-900 uppercase shrink-0"
          >
            Mate<span className="text-blue-600">founder</span>
          </Link>

          <div className="flex flex-wrap items-center gap-x-6 md:gap-x-8 font-bold text-slate-600">
            <Link
              href="/listings"
              className="text-base hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              Оголошення
            </Link>
            <Link
              href="/how-it-works"
              className="text-base hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              Як це працює
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-11 px-5 rounded-xl text-base font-bold text-slate-700 hover:text-blue-600",
            )}
          >
            Увійти
          </Link>

          <Link
            href="/signup"
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-11 text-base font-bold shadow-none",
            )}
          >
            Реєстрація
          </Link>
        </div>
      </div>
    </nav>
  );
}
