import { listAdminUsersAction } from "@/app/actions/admin"
import { AdminGeographyTab } from "@/components/features/admin/admin-geography-tab"
import { AdminUsersTab } from "@/components/features/admin/admin-users-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function AdminConsolePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const usersResult = await listAdminUsersAction(undefined, { offset: 0 })
  const initialUsers = usersResult.ok ? usersResult.users : []
  const initialHasMore = usersResult.ok ? usersResult.hasMore : false
  const initialUsersError = usersResult.ok ? null : usersResult.message

  return (
    <section className="container mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-black text-slate-900">Консоль адміністрування</h1>
      <p className="mt-3 text-slate-600">
        Керування користувачами, доступом та локаціями платформи.
      </p>

      <Tabs defaultValue="users" className="mt-8 w-full">
        <TabsList aria-label="Розділи консолі">
          <TabsTrigger value="users">Користувачі</TabsTrigger>
          <TabsTrigger value="geography">Географія</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <AdminUsersTab
            currentUserId={user?.id ?? ""}
            initialUsers={initialUsers}
            initialHasMore={initialHasMore}
            initialListError={initialUsersError}
          />
        </TabsContent>
        <TabsContent value="geography">
          <AdminGeographyTab />
        </TabsContent>
      </Tabs>
    </section>
  )
}
