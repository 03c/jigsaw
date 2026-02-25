import { Link, useLoaderData } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { StatusBadge } from "~/components/ui/status-badge";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const allSites = await db.query.sites.findMany({
    with: {
      user: true,
      services: true,
    },
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  return { sites: allSites };
}

export default function AdminSites() {
  const { sites: allSites } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        All Sites
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Site
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Owner
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Domain
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Services
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {allSites.map((site) => (
              <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {site.name}
                  </p>
                  <p className="text-xs text-gray-400">{site.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/users/${site.user.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    {site.user.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {site.domain}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={site.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {site.services.length}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/dashboard/sites/${site.id}`}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm font-medium"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
