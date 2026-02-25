import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import {
  listManagedContainers,
  pruneDocker,
  getDockerInfo,
} from "~/lib/docker.server";
import { generateId } from "~/lib/crypto.server";
import { db } from "~/lib/db.server";
import { activityLog } from "~/models/schema";

export async function loader({ request }: { request: Request }) {
  const user = await requireAdmin(request);

  const [containers, dockerInfo] = await Promise.all([
    listManagedContainers().catch(() => []),
    getDockerInfo().catch(() => null),
  ]);

  return { containers, dockerInfo, user };
}

export async function action({ request }: { request: Request }) {
  const user = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    switch (intent) {
      case "prune": {
        const result = await pruneDocker();
        await db.insert(activityLog).values({
          id: generateId(),
          userId: user.id,
          action: "server.prune",
          details: "Pruned unused Docker resources",
        });
        return { success: true, message: "Docker resources pruned successfully" };
      }

      default:
        return { error: "Unknown action" };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed" };
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function AdminServer() {
  const { containers, dockerInfo } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Server Administration
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Docker Info */}
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
                <span className="text-gray-900 dark:text-white">
                  {formatBytes(dockerInfo.MemTotal || 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Actions
          </h2>
          <div className="space-y-3">
            <Form method="post">
              <input type="hidden" name="intent" value="prune" />
              <button
                type="submit"
                disabled={isBusy}
                className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Prune Docker Resources
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Remove unused containers, images, volumes, and networks
                </p>
              </button>
            </Form>
          </div>
        </div>

        {/* Managed Containers */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Jigsaw-Managed Containers ({containers.length})
          </h2>
          {containers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No managed containers running.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                      Image
                    </th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                      State
                    </th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                      Site
                    </th>
                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                      Service
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {containers.map((c) => (
                    <tr key={c.Id}>
                      <td className="py-2 font-mono text-xs text-gray-900 dark:text-white">
                        {c.Names?.[0]?.replace(/^\//, "")}
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-400 text-xs">
                        {c.Image}
                      </td>
                      <td className="py-2">
                        <span
                          className={`text-xs font-medium ${
                            c.State === "running"
                              ? "text-green-600"
                              : "text-gray-500"
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
