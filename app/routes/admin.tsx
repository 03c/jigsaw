import { Outlet, useLoaderData } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { Sidebar } from "~/components/layout/sidebar";

export async function loader({ request }: { request: Request }) {
  const user = await requireAdmin(request);
  const panelHost = new URL(request.url).host;
  return { user, panelHost };
}

export default function AdminLayout() {
  const { user, panelHost } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar user={user} panelHost={panelHost} />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
