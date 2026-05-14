import Link from "next/link";
import { UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, PAGE_SHELL_CLASS } from "@/lib/utils";

export default function ProfileUserNotFound() {
  return (
    <section
      className={cn(
        PAGE_SHELL_CLASS,
        "flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center",
      )}
    >
      <div className="flex max-w-md flex-col items-center gap-6">
        <div
          className="flex size-20 items-center justify-center rounded-2xl border border-blue-100"
          aria-hidden
        >
          <UserX className="size-10 text-blue-600" strokeWidth={1.5} />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Профіль не знайдено
          </h1>
          <p className="text-base leading-relaxed text-slate-500">
            Цього користувача більше не існує або він був заблокований.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full px-8">
          <Link href="/">На головну</Link>
        </Button>
      </div>
    </section>
  );
}
