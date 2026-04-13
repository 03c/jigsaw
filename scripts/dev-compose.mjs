/**
 * Runs `docker compose -f docker-compose.dev.yml` with optional `--env-file .env.local`
 * when that file exists, so Compose variable substitution sees the same overrides as dev:realm.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const composeFile = "docker-compose.dev.yml";
const envLocal = path.join(root, ".env.local");

const extraArgs = process.argv.slice(2);
const dockerArgs = ["compose", "-f", composeFile];
if (existsSync(envLocal)) {
  dockerArgs.push("--env-file", envLocal);
}
dockerArgs.push(...extraArgs);

const r = spawnSync("docker", dockerArgs, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (r.error) throw r.error;
process.exit(r.status ?? 1);
