import Link from "next/link";

import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

type SeekerProfileCompletenessGateProps =
  | {
      variant: "incomplete";
      missingFields: string[];
    }
  | {
      variant: "error";
      message: string;
    };

export function SeekerProfileCompletenessGate(props: SeekerProfileCompletenessGateProps) {
  const description =
    props.variant === "incomplete"
      ? `Щоб почати пошук оголошень та бачити відсоток сумісності, будь ласка, заповніть у профілі: ${props.missingFields.join(", ")}.`
      : props.message;

  const title =
    props.variant === "error" ? "Не вдалося перевірити профіль" : "Ваш профіль не заповнено";

  return (
    <section className="container mx-auto max-w-7xl px-6 py-12">
      <div className="flex min-h-[58vh] flex-col items-center justify-center">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRound className="size-7" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900">{title}</h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">{description}</p>
          <Button asChild size="lg" className="mt-8 h-11 min-w-[220px] font-semibold">
            <Link href="/profile">Перейти до профілю</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
