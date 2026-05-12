import { notFound } from "next/navigation";

import { PAGE_SHELL_CLASS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

type ReviewsPublicPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function ReviewsPublicPage({ params }: ReviewsPublicPageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const displayName =
    profile.username?.trim() ||
    [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(" ") ||
    "Користувач";

  return (
    <section className={PAGE_SHELL_CLASS}>
      <h1 className="text-3xl font-black text-slate-900">Відгуки про {displayName}</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Це публічна сторінка відгуків користувача. Незабаром тут з&apos;явиться повний список оцінок і коментарів.
      </p>
      <div className="mt-10 rounded-2xl border border-blue-100 bg-white/80 px-6 py-14 text-center shadow-sm">
        <p className="text-base font-medium text-slate-600">Відгуків поки немає.</p>
      </div>
    </section>
  );
}
