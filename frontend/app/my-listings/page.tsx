import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <section className="container mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-black text-slate-900">Мої оголошення</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Керуйте своїми оголошеннями та відстежуйте відповіді від інших користувачів.
      </p>
      <div className="mt-10 rounded-2xl border border-blue-100 bg-white/80 px-6 py-14 text-center shadow-sm">
        <p className="text-base font-medium text-slate-600">У вас поки немає активних оголошень.</p>
      </div>
    </section>
  );
}
