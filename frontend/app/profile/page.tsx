import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  return (
    <section className="container mx-auto max-w-lg px-6 py-12">
      <h1 className="text-2xl font-black text-slate-900">Профіль</h1>
      <p className="mt-2 text-slate-600">
        Email: <span className="font-medium">{user.email}</span>
      </p>
      <p className="mt-4 text-sm text-slate-500">
        Далі тут буде повне редагування анкети (місто, бюджет, теги, опис для NLP).
      </p>
      <Button asChild variant="outline" className="mt-6 cursor-pointer">
        <Link href="/">На головну</Link>
      </Button>
    </section>
  );
}
