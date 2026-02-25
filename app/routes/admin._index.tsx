import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { count } from "drizzle-orm";
import { requireAdmin } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { users, sites, activityLog } from "~/models/schema";
import { getServerStats, getDockerStats } from "~/lib/stats.server";
import { StatCard } from "~/components/ui/stat-card";
import { generateId } from "~/lib/crypto.server";
import {
  getDockerInfo,
  listManagedContainers,
  pruneDocker,
} from "~/lib/docker.server";
import { getAdminLinks } from "~/lib/admin-links.server";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function formatRate(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const [[userCount], [siteCount], siteRows, recentActivity, serverStats, dockerStats, dockerInfo, containers] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(sites),
      db.select({ status: sites.status }).from(sites),
      db.query.activityLog.findMany({
        orderBy: (log, { desc }) => [desc(log.createdAt)],
        limit: 20,
        with: { user: true },
      }),
      getServerStats().catch(() => null),
      getDockerStats().catch(() => null),
      getDockerInfo().catch(() => null),
      listManagedContainers().catch(() => []),
    ]);

  const links = getAdminLinks(request.url);

  const siteStatusCounts = siteRows.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { creating: 0, running: 0, stopped: 0, error: 0 } as Record<string, number>
  );

  const serviceCounts = containers.reduce(
    (acc, c) => {
      const service = c.Labels?.["jigsaw.service"] || "other";
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    },
    { web: 0, database: 0, sftp: 0, other: 0 } as Record<string, number>
  );

  return {
    userCount: userCount.value,
    siteCount: siteCount.value,
    siteStatusCounts,
    serviceCounts,
    recentActivity,
    serverStats,
    dockerStats,
    dockerInfo,
    containers,
    links,
  };
}

export async function action({ request }: { request: Request }) {
  const user = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "prune") {
      await pruneDocker();
      await db.insert(activityLog).values({
        id: generateId(),
        userId: user.id,
        action: "server.prune",
        details: "Pruned unused Docker resources",
      });
      return { message: "Docker resources pruned successfully" };
    }

    return { error: "Unknown action" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed" };
  }
}

export default function AdminDashboard() {
  const {
    userCount,
    siteCount,
    siteStatusCounts,
    serviceCounts,
    recentActivity,
    serverStats,
    dockerStats,
    dockerInfo,
    containers,
    links,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Admin Dashboard
      </h1>

      {actionData && "message" in actionData && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
          {actionData.message}
        </div>
      )}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {actionData.error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <a
          href={links.keycloakUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-black transition-colors"
        >
          Open Keycloak
        </a>
        <a
          href={links.traefikUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
        >
          Open Traefik
        </a>
        <Link
          to="/admin/sites"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors"
        >
          Manage Sites
        </Link>
        <Form method="post">
          <input type="hidden" name="intent" value="prune" />
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 transition-colors disabled:opacity-60"
          >
            Prune Docker
          </button>
        </Form>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total Users" value={userCount} color="blue" />
        <StatCard title="Total Sites" value={siteCount} color="green" />
        <StatCard
          title="Docker Containers"
          value={dockerStats ? dockerStats.containersRunning : "N/A"}
          subtitle={dockerStats ? `${dockerStats.containersStopped} stopped` : ""}
          color="yellow"
        />
        <StatCard
          title="Uptime"
          value={serverStats ? formatUptime(serverStats.uptime) : "N/A"}
          color="gray"
        />
        <StatCard
          title="Docker Images"
          value={dockerStats ? dockerStats.images : "N/A"}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Sites Running" value={siteStatusCounts.running} color="green" />
        <StatCard title="Sites Creating" value={siteStatusCounts.creating} color="blue" />
        <StatCard title="Sites Stopped" value={siteStatusCounts.stopped} color="gray" />
        <StatCard title="Sites Error" value={siteStatusCounts.error} color="red" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Web Services" value={serviceCounts.web} color="blue" />
        <StatCard title="DB Services" value={serviceCounts.database} color="yellow" />
        <StatCard title="SFTP Services" value={serviceCounts.sftp} color="green" />
        <StatCard title="Other Services" value={serviceCounts.other} color="gray" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Stats */}
        {serverStats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Server Resources
            </h2>
            <div className="space-y-4">
              {/* CPU */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    CPU ({serverStats.cpu.brand})
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {serverStats.cpu.currentLoad}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(serverStats.cpu.currentLoad, 100)}%` }}
                  />
                </div>
              </div>
              {/* Memory */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Memory</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatBytes(serverStats.memory.used)} / {formatBytes(serverStats.memory.total)} ({serverStats.memory.usedPercent}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(serverStats.memory.usedPercent, 100)}%` }}
                  />
                </div>
              </div>
              {/* Disk */}
              {serverStats.disk.map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Disk {i + 1}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatBytes(d.used)} / {formatBytes(d.total)} ({d.usedPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        d.usedPercent > 90 ? "bg-red-600" : d.usedPercent > 70 ? "bg-yellow-600" : "bg-green-600"
                      }`}
                      style={{ width: `${Math.min(d.usedPercent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {/* OS Info */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                {serverStats.os.distro} {serverStats.os.release} &middot; Kernel {serverStats.os.kernel} &middot; {serverStats.os.hostname}
              </div>
            </div>
          </div>
        )}

        {serverStats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Network Throughput
            </h2>
            {serverStats.network.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No active network interfaces reported.
              </p>
            ) : (
              <div className="space-y-3">
                {serverStats.network.map((net) => (
                  <div
                    key={net.iface}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{net.iface}</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      RX {formatRate(net.rx_sec)} / TX {formatRate(net.tx_sec)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {dockerInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Docker Engine
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Version</span>
                <span className="text-gray-900 dark:text-white">{dockerInfo.ServerVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Containers Running</span>
                <span className="text-gray-900 dark:text-white">{dockerInfo.ContainersRunning}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Containers Stopped</span>
                <span className="text-gray-900 dark:text-white">{dockerInfo.ContainersStopped}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Images</span>
                <span className="text-gray-900 dark:text-white">{dockerInfo.Images}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">CPUs</span>
                <span className="text-gray-900 dark:text-white">{dockerInfo.NCPU}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Memory</span>
                <span className="text-gray-900 dark:text-white">{formatBytes(dockerInfo.MemTotal || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-gray-900 dark:text-white">
                      <span className="font-medium">{entry.user?.name || "System"}</span>{" "}
                      {entry.details || entry.action}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Jigsaw-Managed Containers ({containers.length})
          </h2>
          {containers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No managed containers running.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Image</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">State</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Site</th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {containers.map((c) => (
                    <tr key={c.Id}>
                      <td className="py-2 font-mono text-xs text-gray-900 dark:text-white">
                        {c.Names?.[0]?.replace(/^\//, "")}
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-400 text-xs">{c.Image}</td>
                      <td className="py-2">
                        <span
                          className={`text-xs font-medium ${
                            c.State === "running" ? "text-green-600" : "text-gray-500"
                          }`}
                        >
                          {c.State}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-600 dark:text-gray-400">
                        {c.Labels?.["jigsaw.site"] || "-"}
                      </td>
                      <td className="py-2 text-xs text-gray-600 dark:text-gray-400">
                        {c.Labels?.["jigsaw.service"] || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
