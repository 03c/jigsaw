import { Form, redirect, useActionData, useNavigation } from "react-router";
import { eq, count } from "drizzle-orm";
import { requireUser } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { sites, services, users, activityLog } from "~/models/schema";
import {
  generateId,
  slugify,
  generatePassword,
  generateDbUsername,
  generateDbName,
} from "~/lib/crypto.server";
import {
  createSiteNetwork,
  createWebContainer,
  createDbContainer,
  createSftpContainer,
  findAvailableSftpPort,
} from "~/lib/docker.server";

export async function loader({ request }: { request: Request }) {
  await requireUser(request);
  return {};
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const domain = (formData.get("domain") as string)?.trim();
  const phpVersion = (formData.get("phpVersion") as string) || "8.4";
  const createDatabase = formData.get("createDatabase") === "on";
  const enableSftp = formData.get("enableSftp") === "on";

  // Validation
  const errors: Record<string, string> = {};
  if (!name || name.length < 2) errors.name = "Site name must be at least 2 characters";
  if (!domain || !domain.includes(".")) errors.domain = "Please enter a valid domain";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Check site limit
  const [siteCount] = await db
    .select({ value: count() })
    .from(sites)
    .where(eq(sites.userId, user.id));

  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (siteCount.value >= (userRecord?.maxSites || 5)) {
    return { errors: { name: "You have reached your maximum number of sites" } };
  }

  const slug = slugify(name);

  // Check slug uniqueness
  const existing = await db.query.sites.findFirst({
    where: eq(sites.slug, slug),
  });
  if (existing) {
    return { errors: { name: "A site with this name already exists" } };
  }

  const siteId = generateId();
  const networkName = `jigsaw_${slug}_net`;
  const ownerSegment = slugify(user.email.split("@")[0] || user.id);
  const dbName = generateDbName(slug);
  const dbUser = generateDbUsername(slug);
  const dbPassword = generatePassword();
  const dbRootPassword = generatePassword();

  try {
    // Create site record first
    await db.insert(sites).values({
      id: siteId,
      userId: user.id,
      name,
      slug,
      domain,
      phpVersion,
      networkName,
      status: "creating",
    });

    // Create Docker network
    await createSiteNetwork(slug);

    if (createDatabase) {
      // Create database container
      const dbContainerId = await createDbContainer({
        slug,
        ownerSegment,
        domain,
        phpVersion,
        dbName,
        dbUser,
        dbPassword,
        dbRootPassword,
      });

      await db.insert(services).values({
        id: generateId(),
        siteId,
        type: "database",
        containerId: dbContainerId,
        containerName: `jigsaw_${slug}_db`,
        status: "running",
        config: {
          dbName,
          dbUser,
          dbPassword,
          dbRootPassword,
          host: `jigsaw_${slug}_db`,
          port: 3306,
        },
      });
    }

    // Create web container
    const webContainerId = await createWebContainer({
      slug,
      ownerSegment,
      domain,
      phpVersion,
      dbName,
      dbUser,
      dbPassword,
      dbRootPassword,
    });

    await db.insert(services).values({
      id: generateId(),
      siteId,
      type: "web",
      containerId: webContainerId,
      containerName: `jigsaw_${slug}_web`,
      status: "running",
      config: {
        phpVersion,
        domain,
      },
    });

    if (enableSftp) {
      const sftpPort = await findAvailableSftpPort();
      const sftpUser = `sftp_${slug}`;
      const sftpPassword = generatePassword(24);

      const sftpContainerId = await createSftpContainer({
        slug,
        ownerSegment,
        domain,
        phpVersion,
        dbName,
        dbUser,
        dbPassword,
        dbRootPassword,
        sftpUser,
        sftpPassword,
        sftpPort,
      });

      await db.insert(services).values({
        id: generateId(),
        siteId,
        type: "sftp",
        containerId: sftpContainerId,
        containerName: `jigsaw_${slug}_sftp`,
        status: "running",
        config: {
          sftpUser,
          sftpPassword,
          sftpPort,
          hostPath: `/home/${ownerSegment}/${slug}`,
        },
      });
    }

    // Update site status to running
    await db
      .update(sites)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(sites.id, siteId));

    // Log activity
    await db.insert(activityLog).values({
      id: generateId(),
      userId: user.id,
      action: "site.created",
      details: `Created site "${name}" (${domain})`,
    });

    return redirect(`/dashboard/sites/${siteId}`);
  } catch (err) {
    console.error("Site creation error:", err);

    // Update site status to error
    await db
      .update(sites)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(sites.id, siteId));

    return {
      errors: {
        name: `Failed to create site: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
    };
  }
}

export default function NewSite() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        Create New Site
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Set up a new website with flexible services and one-click SSL.
      </p>

      <Form method="post" className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {/* Site Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Site Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="My Awesome Site"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            {actionData?.errors?.name && (
              <p className="text-sm text-red-600 mt-1">{actionData.errors.name}</p>
            )}
          </div>

          {/* Domain */}
          <div>
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Domain
            </label>
            <input
              type="text"
              id="domain"
              name="domain"
              required
              placeholder="example.com"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            {actionData?.errors?.domain && (
              <p className="text-sm text-red-600 mt-1">{actionData.errors.domain}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Point your domain's A record to this server's IP address.
            </p>
          </div>

          {/* PHP Version */}
          <div>
            <label
              htmlFor="phpVersion"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              PHP Version
            </label>
            <select
              id="phpVersion"
              name="phpVersion"
              defaultValue="8.4"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="8.4">PHP 8.4 (Latest)</option>
            </select>
          </div>

          <div className="pt-2 space-y-3">
            <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                id="createDatabase"
                name="createDatabase"
                defaultChecked
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="font-medium text-gray-900 dark:text-white">Create database</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Provision a MariaDB service with generated credentials.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                id="enableSftp"
                name="enableSftp"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="font-medium text-gray-900 dark:text-white">Enable SFTP access</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Creates a secure file service mapped to your site folder.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* What will be created */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            This will create:
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>- Isolated Docker network</li>
            <li>- Web server (Nginx + PHP-FPM)</li>
            <li>- Optional MariaDB database</li>
            <li>- Optional SFTP file access</li>
            <li>- Site files under /home/&lt;user&gt;/&lt;site&gt;/public_html</li>
            <li>- SSL certificate (via Let's Encrypt)</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {isSubmitting ? "Creating site..." : "Create Site"}
        </button>
      </Form>
    </div>
  );
}
