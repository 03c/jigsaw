import { Link, useLoaderData, Form, useNavigation } from "react-router";
import { eq } from "drizzle-orm";
import { requireAdmin } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { users, sites } from "~/models/schema";
import { StatusBadge } from "~/components/ui/status-badge";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  await requireAdmin(request);

  const user = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });

  if (!user) {
    throw new Response("User not found", { status: 404 });
  }

  const userSites = await db.query.sites.findMany({
    where: eq(sites.userId, params.id),
    with: { services: true },
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  return { user, sites: userSites };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update-quota") {
    const maxSites = parseInt(formData.get("maxSites") as string) || 5;
    await db
      .update(users)
      .set({ maxSites, updatedAt: new Date() })
      .where(eq(users.id, params.id));
  }

  return { success: true };
}

export default function AdminUserDetail() {
  const { user, sites: userSites } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/admin/users"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {user.name}
        </h1>
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            user.role === "admin"
              ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          }`}
        >
          {user.role}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            User Info
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Keycloak ID</p>
              <p className="font-mono text-xs text-gray-900 dark:text-white">{user.keycloakId}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Joined</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(user.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Quota */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Site Quota
          </h2>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="update-quota" />
            <div>
              <label htmlFor="maxSites" className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                Maximum sites allowed
              </label>
              <input
                type="number"
                id="maxSites"
                name="maxSites"
                defaultValue={user.maxSites}
                min={0}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Currently using {userSites.length} of {user.maxSites} slots
            </p>
            <button
              type="submit"
              disabled={isBusy}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Update Quota
            </button>
          </Form>
        </div>

        {/* User's sites */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Sites ({userSites.length})
          </h2>
          {userSites.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This user has no sites yet.
            </p>
          ) : (
            <div className="space-y-2">
              {userSites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {site.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {site.domain} &middot; {site.services.length} services
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={site.status} />
                    <Link
                      to={`/dashboard/sites/${site.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Manage
                    </Link>
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
