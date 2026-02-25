import Docker from "dockerode";
import path from "node:path";
import fs from "node:fs/promises";
import {
  resolveDbImage,
  resolveSftpImage,
  resolveWebImage,
} from "~/lib/images.server";

function createDockerClient(): Docker {
  const configuredSocket = process.env.DOCKER_SOCKET_PATH;

  if (configuredSocket) {
    return new Docker({ socketPath: configuredSocket });
  }

  if (process.platform === "win32") {
    return new Docker({ socketPath: "//./pipe/docker_engine" });
  }

  return new Docker({ socketPath: "/var/run/docker.sock" });
}

// Connect to the Docker daemon (Linux socket in container, npipe on Windows host)
const docker = createDockerClient();

export { docker };

// Base path for site data (inside the panel container)
const SITES_BASE_PATH_HOST = process.env.SITES_BASE_PATH_HOST || "/home";
const SITES_BASE_PATH_PANEL = process.env.SITES_BASE_PATH_PANEL || "/host-home";
const DB_DATA_PATH = process.env.DB_DATA_PATH || "/app/data/databases";
const TEMPLATES_PATH = process.env.TEMPLATES_PATH || "/app/docker/templates";
const TRAEFIK_NETWORK = "traefik_public";

export interface SiteContainerConfig {
  slug: string;
  ownerSegment: string;
  domain: string;
  phpVersion: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbRootPassword: string;
}

function getSitePaths(ownerSegment: string, slug: string) {
  const hostSiteRoot = path.join(SITES_BASE_PATH_HOST, ownerSegment, slug);
  const panelSiteRoot = path.join(SITES_BASE_PATH_PANEL, ownerSegment, slug);

  return {
    hostSiteRoot,
    panelSiteRoot,
    hostWebRoot: path.join(hostSiteRoot, "public_html"),
    panelWebRoot: path.join(panelSiteRoot, "public_html"),
  };
}

/**
 * Create an isolated Docker network for a site.
 */
export async function createSiteNetwork(slug: string): Promise<string> {
  const networkName = `jigsaw_${slug}_net`;
  await docker.createNetwork({
    Name: networkName,
    Driver: "bridge",
    Labels: {
      "jigsaw.managed": "true",
      "jigsaw.site": slug,
    },
  });
  return networkName;
}

/**
 * Create the web container (Nginx + PHP-FPM) for a site.
 */
export async function createWebContainer(
  config: SiteContainerConfig
): Promise<string> {
  const containerName = `jigsaw_${config.slug}_web`;
  const sitePaths = getSitePaths(config.ownerSegment, config.slug);
  const networkName = `jigsaw_${config.slug}_net`;
  const siteTemplatePath = path.join(TEMPLATES_PATH, "site", "index.html");

  // Ensure webroot directory exists and has a default index.html
  await fs.mkdir(sitePaths.panelWebRoot, { recursive: true });
  const indexPath = path.join(sitePaths.panelWebRoot, "index.html");
  try {
    await fs.access(indexPath);
  } catch {
    const siteTemplate = await fs.readFile(siteTemplatePath, "utf-8");
    const rendered = siteTemplate
      .replaceAll("{{DOMAIN}}", config.domain)
      .replaceAll("{{SITE_SLUG}}", config.slug)
      .replaceAll("{{OWNER_SEGMENT}}", config.ownerSegment)
      .replaceAll(
        "{{SITE_PATH}}",
        `/home/${config.ownerSegment}/${config.slug}/public_html`
      );

    await fs.writeFile(
      indexPath,
      rendered,
      "utf-8"
    );
  }

  const container = await docker.createContainer({
    Image: resolveWebImage(config.phpVersion),
    name: containerName,
    Hostname: containerName,
    Env: [
      `DB_HOST=jigsaw_${config.slug}_db`,
      `DB_NAME=${config.dbName}`,
      `DB_USER=${config.dbUser}`,
      `DB_PASSWORD=${config.dbPassword}`,
    ],
    Labels: {
      "jigsaw.managed": "true",
      "jigsaw.site": config.slug,
      "jigsaw.service": "web",
      // Traefik labels for automatic routing
      "traefik.enable": "true",
      [`traefik.http.routers.${config.slug}.rule`]: `Host(\`${config.domain}\`)`,
      [`traefik.http.routers.${config.slug}.tls.certresolver`]: "letsencrypt",
      [`traefik.http.services.${config.slug}.loadbalancer.server.port`]: "80",
      [`traefik.docker.network`]: TRAEFIK_NETWORK,
    },
    HostConfig: {
      Binds: [`${sitePaths.hostWebRoot}:/var/www/html`],
      RestartPolicy: { Name: "unless-stopped" },
    },
    NetworkingConfig: {
      EndpointsConfig: {
        [networkName]: {},
      },
    },
  });

  // Also connect to traefik_public so Traefik can route traffic
  const traefikNet = docker.getNetwork(TRAEFIK_NETWORK);
  await traefikNet.connect({ Container: container.id });

  await container.start();
  return container.id;
}

/**
 * Create the MariaDB container for a site.
 */
export async function createDbContainer(
  config: SiteContainerConfig
): Promise<string> {
  const containerName = `jigsaw_${config.slug}_db`;
  const dbDataHost = path.join(DB_DATA_PATH, config.slug);
  const networkName = `jigsaw_${config.slug}_net`;

  await fs.mkdir(dbDataHost, { recursive: true });

  const container = await docker.createContainer({
    Image: resolveDbImage(),
    name: containerName,
    Hostname: containerName,
    Env: [
      `MYSQL_ROOT_PASSWORD=${config.dbRootPassword}`,
      `MYSQL_DATABASE=${config.dbName}`,
      `MYSQL_USER=${config.dbUser}`,
      `MYSQL_PASSWORD=${config.dbPassword}`,
    ],
    Labels: {
      "jigsaw.managed": "true",
      "jigsaw.site": config.slug,
      "jigsaw.service": "database",
    },
    HostConfig: {
      Binds: [`${dbDataHost}:/var/lib/mysql`],
      RestartPolicy: { Name: "unless-stopped" },
    },
    NetworkingConfig: {
      EndpointsConfig: {
        [networkName]: {},
      },
    },
  });

  await container.start();
  return container.id;
}

/**
 * Create an SFTP container for a site.
 */
export async function createSftpContainer(
  config: SiteContainerConfig & { sftpUser: string; sftpPassword: string; sftpPort: number }
): Promise<string> {
  const containerName = `jigsaw_${config.slug}_sftp`;
  const sitePaths = getSitePaths(config.ownerSegment, config.slug);
  const networkName = `jigsaw_${config.slug}_net`;

  const container = await docker.createContainer({
    Image: resolveSftpImage(),
    name: containerName,
    Hostname: containerName,
    Env: [],
    // atmoz/sftp uses command-line user spec: user:password:uid
    Cmd: [`${config.sftpUser}:${config.sftpPassword}:1000`],
    Labels: {
      "jigsaw.managed": "true",
      "jigsaw.site": config.slug,
      "jigsaw.service": "sftp",
    },
    HostConfig: {
      Binds: [`${sitePaths.hostSiteRoot}:/home/${config.sftpUser}/${config.slug}`],
      PortBindings: {
        "22/tcp": [{ HostPort: String(config.sftpPort) }],
      },
      RestartPolicy: { Name: "unless-stopped" },
    },
    ExposedPorts: { "22/tcp": {} },
    NetworkingConfig: {
      EndpointsConfig: {
        [networkName]: {},
      },
    },
  });

  await container.start();
  return container.id;
}

/**
 * Stop and remove a container by ID or name.
 */
export async function removeContainer(containerIdOrName: string): Promise<void> {
  try {
    const container = docker.getContainer(containerIdOrName);
    try {
      await container.stop({ t: 10 });
    } catch {
      // Container may already be stopped
    }
    await container.remove({ force: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("no such container")) {
      throw err;
    }
  }
}

/**
 * Remove a Docker network by name.
 */
export async function removeSiteNetwork(networkName: string): Promise<void> {
  try {
    const network = docker.getNetwork(networkName);
    await network.remove();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("not found")) {
      throw err;
    }
  }
}

/**
 * Start a stopped container.
 */
export async function startContainer(containerIdOrName: string): Promise<void> {
  const container = docker.getContainer(containerIdOrName);
  await container.start();
}

/**
 * Stop a running container.
 */
export async function stopContainer(containerIdOrName: string): Promise<void> {
  const container = docker.getContainer(containerIdOrName);
  await container.stop({ t: 10 });
}

/**
 * Restart a container.
 */
export async function restartContainer(containerIdOrName: string): Promise<void> {
  const container = docker.getContainer(containerIdOrName);
  await container.restart({ t: 10 });
}

/**
 * Get container logs (last N lines).
 */
export async function getContainerLogs(
  containerIdOrName: string,
  tail = 100
): Promise<string> {
  const container = docker.getContainer(containerIdOrName);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  return logs.toString();
}

/**
 * Get container inspect info (status, state, etc.).
 */
export async function getContainerInfo(containerIdOrName: string) {
  const container = docker.getContainer(containerIdOrName);
  return container.inspect();
}

/**
 * Get resource stats for a container.
 */
export async function getContainerStats(containerIdOrName: string) {
  const container = docker.getContainer(containerIdOrName);
  const stats = await container.stats({ stream: false });
  return stats;
}

/**
 * List all Jigsaw-managed containers.
 */
export async function listManagedContainers() {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: ["jigsaw.managed=true"],
    },
  });
  return containers;
}

/**
 * Get Docker system-wide information.
 */
export async function getDockerInfo() {
  return docker.info();
}

/**
 * Prune unused Docker resources.
 */
export async function pruneDocker() {
  const [containers, images, volumes, networks] = await Promise.all([
    docker.pruneContainers({ filters: { label: ["jigsaw.managed=true"] } }),
    docker.pruneImages(),
    docker.pruneVolumes(),
    docker.pruneNetworks(),
  ]);
  return { containers, images, volumes, networks };
}

/**
 * Find the next available SFTP port in the 2200-2299 range.
 */
export async function findAvailableSftpPort(): Promise<number> {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ["jigsaw.service=sftp"] },
  });

  const usedPorts = new Set<number>();
  for (const c of containers) {
    for (const p of c.Ports || []) {
      if (p.PublicPort && p.PublicPort >= 2200 && p.PublicPort <= 2299) {
        usedPorts.add(p.PublicPort);
      }
    }
  }

  for (let port = 2200; port <= 2299; port++) {
    if (!usedPorts.has(port)) return port;
  }

  throw new Error("No available SFTP ports in range 2200-2299");
}
