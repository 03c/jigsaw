import { Form, Link, useLoaderData, useActionData, useNavigation } from "react-router";
import { eq, and } from "drizzle-orm";
import { requireUser } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { sites, services, activityLog } from "~/models/schema";
import {
  startContainer,
  stopContainer,
  restartContainer,
  getContainerLogs,
  removeContainer,
  removeSiteNetwork,
  createSftpContainer,
  findAvailableSftpPort,
} from "~/lib/docker.server";
import { generateId, generatePassword } from "~/lib/crypto.server";
import { StatusBadge } from "~/components/ui/status-badge";

function toOwnerSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "user"
  );
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const user = await requireUser(request);

  const site = await db.query.sites.findFirst({
    where:
      user.role === "admin"
        ? eq(sites.id, params.id)
        : and(eq(sites.id, params.id), eq(sites.userId, user.id)),
    with: {
      services: true,
      user: true,
    },
  });

  if (!site) {
    throw new Response("Site not found", { status: 404 });
  }

  // Get logs for the web container
  let webLogs = "";
  const webService = site.services.find((s) => s.type === "web");
  if (webService?.containerId) {
    try {
      webLogs = await getContainerLogs(webService.containerId, 50);
    } catch {
      webLogs = "Unable to fetch logs";
    }
  }

  return { site, webLogs, user };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const site = await db.query.sites.findFirst({
    where:
      user.role === "admin"
        ? eq(sites.id, params.id)
        : and(eq(sites.id, params.id), eq(sites.userId, user.id)),
    with: { services: true, user: true },
  });

  if (!site) {
    throw new Response("Site not found", { status: 404 });
  }

  try {
    switch (intent) {
      case "start": {
        for (const svc of site.services) {
          if (svc.containerId) {
            await startContainer(svc.containerId);
            await db
              .update(services)
              .set({ status: "running", updatedAt: new Date() })
              .where(eq(services.id, svc.id));
          }
        }
        await db
          .update(sites)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(sites.id, site.id));
        break;
      }

      case "stop": {
        for (const svc of site.services) {
          if (svc.containerId) {
            await stopContainer(svc.containerId);
            await db
              .update(services)
              .set({ status: "stopped", updatedAt: new Date() })
              .where(eq(services.id, svc.id));
          }
        }
        await db
          .update(sites)
          .set({ status: "stopped", updatedAt: new Date() })
          .where(eq(sites.id, site.id));
        break;
      }

      case "restart": {
        for (const svc of site.services) {
          if (svc.containerId) {
            await restartContainer(svc.containerId);
          }
        }
        break;
      }

      case "enable-sftp": {
        const sftpPort = await findAvailableSftpPort();
        const sftpUser = `sftp_${site.slug}`;
        const sftpPassword = generatePassword(24);
        const ownerSegment = toOwnerSegment(
          (site.user?.email || site.userId).split("@")[0] || site.userId
        );

        // Get DB config from existing db service
        const dbService = site.services.find((s) => s.type === "database");
        const dbConfig = (dbService?.config || {}) as Record<string, unknown>;

        const containerId = await createSftpContainer({
          slug: site.slug,
          ownerSegment,
          domain: site.domain,
          phpVersion: site.phpVersion,
          dbName: (dbConfig.dbName as string) || "",
          dbUser: (dbConfig.dbUser as string) || "",
          dbPassword: (dbConfig.dbPassword as string) || "",
          dbRootPassword: (dbConfig.dbRootPassword as string) || "",
          sftpUser,
          sftpPassword,
          sftpPort,
        });

        await db.insert(services).values({
          id: generateId(),
          siteId: site.id,
          type: "sftp",
          containerId,
          containerName: `jigsaw_${site.slug}_sftp`,
          status: "running",
          config: {
            sftpUser,
            sftpPassword,
            sftpPort,
            hostPath: `/home/${ownerSegment}/${site.slug}`,
          },
        });
        break;
      }

      case "delete": {
        // Remove all containers
        for (const svc of site.services) {
          if (svc.containerId) {
            await removeContainer(svc.containerId);
          }
        }
        // Remove network
        await removeSiteNetwork(site.networkName);
        // Delete from database (cascades to services)
        await db.delete(sites).where(eq(sites.id, site.id));

        await db.insert(activityLog).values({
          id: generateId(),
          userId: user.id,
          action: "site.deleted",
          details: `Deleted site "${site.name}" (${site.domain})`,
        });

        return { redirect: "/dashboard" };
      }
    }

    // Log activity
    if (intent !== "delete") {
      await db.insert(activityLog).values({
        id: generateId(),
        userId: user.id,
        action: `site.${intent}`,
        details: `${intent} site "${site.name}"`,
      });
    }

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Action failed",
    };
  }
}

export default function SiteDetail() {
  const { site, webLogs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  if (actionData && "redirect" in actionData) {
    return null; // Will redirect
  }

  const webService = site.services.find((s: { type: string }) => s.type === "web");
  const dbService = site.services.find((s: { type: string }) => s.type === "database");
  const sftpService = site.services.find((s: { type: string }) => s.type === "sftp");
  const dbConfig = (dbService?.config || {}) as Record<string, unknown>;
  const sftpConfig = (sftpService?.config || {}) as Record<string, unknown>;
  const ownerSegment = toOwnerSegment(
    (site.user?.email || site.userId).split("@")[0] || site.userId
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {site.name}
            </h1>
            <StatusBadge status={site.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-8">
            {site.domain} &middot; {site.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Form method="post">
            <input type="hidden" name="intent" value="start" />
            <button
              type="submit"
              disabled={isBusy || site.status === "running"}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Start
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="stop" />
            <button
              type="submit"
              disabled={isBusy || site.status === "stopped"}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Stop
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="restart" />
            <button
              type="submit"
              disabled={isBusy}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Restart
            </button>
          </Form>
        </div>
      </div>

      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {actionData.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Services
          </h2>
          <div className="space-y-3">
            {/* Web */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Web Server</p>
                <p className="text-xs text-gray-400">Nginx + PHP {site.phpVersion}</p>
              </div>
              <StatusBadge status={webService?.status || "stopped"} />
            </div>
            {/* DB */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Database</p>
                <p className="text-xs text-gray-400">{dbService ? "MariaDB" : "Not enabled"}</p>
              </div>
              <StatusBadge status={dbService?.status || "stopped"} />
            </div>
            {/* SFTP */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">SFTP</p>
                <p className="text-xs text-gray-400">
                  {sftpService ? `Port ${sftpConfig.sftpPort}` : "Not enabled"}
                </p>
              </div>
              {sftpService ? (
                <StatusBadge status={sftpService.status} />
              ) : (
                <Form method="post">
                  <input type="hidden" name="intent" value="enable-sftp" />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors"
                  >
                    Enable
                  </button>
                </Form>
              )}
            </div>
          </div>
        </div>

        {/* Database Credentials */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Database Credentials
          </h2>
          {dbService ? (
            <div className="space-y-3 font-mono text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Host (internal)</p>
                <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white">
                  {`jigsaw_${site.slug}_db`}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Database</p>
                <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white">
                  {String(dbConfig.dbName || "")}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Username</p>
                <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white">
                  {String(dbConfig.dbUser || "")}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Password</p>
                <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white break-all">
                  {String(dbConfig.dbPassword || "")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No database is enabled for this site.</p>
          )}

          {sftpService && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-4">
                SFTP Credentials
              </h2>
              <div className="space-y-3 font-mono text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Host</p>
                  <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white">
                    {`your-server-ip:${sftpConfig.sftpPort}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Path</p>
                  <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white break-all">
                    {String(sftpConfig.hostPath || `/home/${ownerSegment}/${site.slug}`)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Username</p>
                  <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white">
                    {String(sftpConfig.sftpUser || "")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Password</p>
                  <p className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-gray-900 dark:text-white break-all">
                    {String(sftpConfig.sftpPassword || "")}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Logs */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Web Server Logs
          </h2>
          <pre className="bg-gray-950 text-gray-300 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
            {webLogs || "No logs available"}
          </pre>
        </div>

        {/* Danger Zone */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
            Danger Zone
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            This will permanently delete the site, all containers, and all associated data.
          </p>
          <Form method="post" onSubmit={(e) => {
            if (!confirm("Are you sure you want to delete this site? This cannot be undone.")) {
              e.preventDefault();
            }
          }}>
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              disabled={isBusy}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Delete Site
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
