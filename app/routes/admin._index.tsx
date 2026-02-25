import { useLoaderData } from "react-router";
import { count } from "drizzle-orm";
import { requireAdmin } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { users, sites, activityLog } from "~/models/schema";
import { getServerStats, getDockerStats } from "~/lib/stats.server";
import { StatCard } from "~/components/ui/stat-card";

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

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const [[userCount], [siteCount], recentActivity, serverStats, dockerStats] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(sites),
      db.query.activityLog.findMany({
        orderBy: (log, { desc }) => [desc(log.createdAt)],
        limit: 20,
        with: { user: true },
      }),
      getServerStats().catch(() => null),
      getDockerStats().catch(() => null),
    ]);

  return {
    userCount: userCount.value,
    siteCount: siteCount.value,
    recentActivity,
    serverStats,
    dockerStats,
  };
}

export default function AdminDashboard() {
  const { userCount, siteCount, recentActivity, serverStats, dockerStats } =
    useLoaderData<typeof loader>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Admin Dashboard
      </h1>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
      </div>
    </div>
  );
}
