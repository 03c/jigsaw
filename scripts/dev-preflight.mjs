/**
 * Ensures local backing services are up before `react-router dev`.
 * Optional: set SKIP_DEV_SERVICES=1 to only run the dev server (e.g. UI-only work).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process, { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

async function waitForKeycloakReady() {
  const url = "http://localhost:8080/realms/jigsaw/.well-known/openid-configuration";
  const maxAttempts = 90;
  const delayMs = 2000;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok) {
        console.log("Keycloak OIDC endpoint is ready.");
        return;
      }
    } catch {
      /* retry */
    }
    console.log(`Waiting for Keycloak (${i}/${maxAttempts})…`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.error(
    "\nKeycloak did not become ready in time. Try: npm run dev:services:logs\n"
  );
  process.exit(1);
}

function assertDockerAvailable() {
  const r = spawnSync("docker", ["compose", "version"], {
    cwd: root,
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(
      "Docker Compose is required. Install Docker and ensure `docker compose` works, then retry.\n"
    );
    process.exit(1);
  }
}

function runDevServer() {
  const child = spawn("npx", ["react-router", "dev"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

async function main() {
  const envLocalPath = path.join(root, ".env.local");
  if (existsSync(envLocalPath)) {
    loadEnvFile(envLocalPath);
  }

  if (process.env.SKIP_DEV_SERVICES === "1") {
    console.log("SKIP_DEV_SERVICES=1 — skipping PostgreSQL/Keycloak startup.\n");
    runDevServer();
    return;
  }

  assertDockerAvailable();

  console.log("Preparing dev Keycloak realm…");
  run(process.execPath, [path.join(root, "scripts", "prepare-dev-realm.mjs")]);

  console.log("Starting PostgreSQL + Keycloak (docker-compose.dev.yml)…");
  run("docker", ["compose", "-f", "docker-compose.dev.yml", "up", "-d"]);

  await waitForKeycloakReady();

  console.log("Applying database schema (drizzle-kit push)…");
  run("npx", ["drizzle-kit", "push"]);

  console.log("Starting Vite + React Router dev server…\n");
  runDevServer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
