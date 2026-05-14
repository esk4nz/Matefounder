import { listAdminReportsAction } from "@/app/actions/admin-reports";
import { AdminReportsTab } from "@/components/features/admin/admin-reports-tab";
import { PAGE_SHELL_CLASS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminComplaintsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const reportsResult = await listAdminReportsAction({ offset: 0 });
  const initialReports = reportsResult.ok ? reportsResult.reports : [];
  const initialHasMore = reportsResult.ok ? reportsResult.hasMore : false;
  const initialListError = reportsResult.ok ? null : reportsResult.message;

  return (
    <section className={PAGE_SHELL_CLASS}>
      <h1 className="text-3xl font-black text-slate-900">Скарги</h1>
      <p className="mt-3 text-slate-600">Облік та розгляд звернень користувачів.</p>

      <div className="mt-8">
        <AdminReportsTab
          currentUserId={user?.id ?? ""}
          initialReports={initialReports}
          initialHasMore={initialHasMore}
          initialListError={initialListError}
        />
      </div>
    </section>
  );
}
