import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <section className="container mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-black text-slate-900">Оголошення</h1>
      <p className="mt-3 text-slate-600">Розділ у розробці.</p>
    </section>
  );
}
