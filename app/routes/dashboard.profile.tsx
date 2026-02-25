import { useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import { requireUser } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { users, sites } from "~/models/schema";
import { count } from "drizzle-orm";

export async function loader({ request }: { request: Request }) {
  const sessionUser = await requireUser(request);
  const panelHost = new URL(request.url).host;

  const user = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
  });

  const [siteCount] = await db
    .select({ value: count() })
    .from(sites)
    .where(eq(sites.userId, sessionUser.id));

  return {
    user: user || sessionUser,
    siteCount: siteCount.value,
    keycloakAccountUrl: `https://auth.${panelHost}/realms/jigsaw/account/`,
  };
}

export default function Profile() {
  const { user, siteCount, keycloakAccountUrl } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Profile
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {user.name}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {user.email}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
            {user.role}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sites</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {siteCount} / {"maxSites" in user ? String(user.maxSites) : "5"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Member since</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {"createdAt" in user && user.createdAt
              ? new Date(String(user.createdAt)).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          To change your password or enable MFA, visit the{" "}
          <a
            href={keycloakAccountUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Keycloak account console
          </a>
          .
        </p>
      </div>
    </div>
  );
}
