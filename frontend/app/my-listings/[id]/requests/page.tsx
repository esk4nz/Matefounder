import { redirect } from "next/navigation";

import { getIncomingRequestsAction } from "@/app/actions/listings";
import { OwnerRequestsView } from "@/components/features/listings/owner-requests-view";
import { PAGE_SHELL_CLASS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OwnerListingRequestsPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const result = await getIncomingRequestsAction(id);
  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      redirect("/login");
    }
    redirect("/my-listings");
  }

  return (
    <section className={PAGE_SHELL_CLASS}>
      <OwnerRequestsView
        listingId={id}
        listingTitle={result.listingTitle}
        listingUpdatedAt={result.listingUpdatedAt}
        initialRequests={result.requests}
      />
    </section>
  );
}
