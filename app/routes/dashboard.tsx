import { Outlet, useLoaderData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { Sidebar } from "~/components/layout/sidebar";
import { getAdminLinks } from "~/lib/admin-links.server";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const links = getAdminLinks(request.url);
  return { user, links };
}

export default function DashboardLayout() {
  const { user, links } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar user={user} keycloakUrl={links.keycloakUrl} traefikUrl={links.traefikUrl} />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
