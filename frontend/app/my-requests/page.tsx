import { redirect } from "next/navigation";

import { getMyRequestsAction } from "@/app/actions/listings";
import { MyRequestsView } from "@/components/features/listings/my-requests-view";
import { PAGE_SHELL_CLASS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await getMyRequestsAction();
  const listings = result.ok ? result.listings : [];

  return (
    <section className={PAGE_SHELL_CLASS}>
      <MyRequestsView userId={user.id} initialListings={listings} />
    </section>
  );
}
