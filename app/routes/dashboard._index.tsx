import { Link, useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import { requireUser } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { sites, services } from "~/models/schema";
import { StatusBadge } from "~/components/ui/status-badge";
import { StatCard } from "~/components/ui/stat-card";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);

  const userSites = await db.query.sites.findMany({
    where: eq(sites.userId, user.id),
    with: {
      services: true,
    },
    orderBy: (sites, { desc }) => [desc(sites.createdAt)],
  });

  const stats = {
    total: userSites.length,
    running: userSites.filter((s) => s.status === "running").length,
    stopped: userSites.filter((s) => s.status === "stopped").length,
    error: userSites.filter((s) => s.status === "error").length,
  };

  return { sites: userSites, stats, user };
}

export default function DashboardIndex() {
  const { sites: userSites, stats } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your websites and services
          </p>
        </div>
        <Link
          to="/dashboard/sites/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16" />
          </svg>
          New Site
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Sites" value={stats.total} color="blue" />
        <StatCard title="Running" value={stats.running} color="green" />
        <StatCard title="Stopped" value={stats.stopped} color="gray" />
        <StatCard title="Errors" value={stats.error} color="red" />
      </div>

      {/* Sites table */}
      {userSites.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No sites yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Get started by creating your first website.
          </p>
          <Link
            to="/dashboard/sites/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Create your first site
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Site
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
              {userSites.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/dashboard/sites/${site.id}`}
                      className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {site.name}
                    </Link>
                    <p className="text-xs text-gray-400">{site.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {site.domain}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={site.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {site.services.length} active
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/dashboard/sites/${site.id}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
