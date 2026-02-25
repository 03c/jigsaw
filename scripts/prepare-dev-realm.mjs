import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "keycloak", "jigsaw-realm.json");
const targetPath = path.join(root, "keycloak", "jigsaw-realm.dev.json");

const panelDomain = process.env.PANEL_DOMAIN || "localhost:5173";
const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || "dev-jigsaw-client-secret";
const adminEmail = process.env.JIGSAW_ADMIN_EMAIL || "admin@localhost";
const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || "admin";

const realmTemplate = await fs.readFile(sourcePath, "utf-8");

const realm = realmTemplate
  .replaceAll("JIGSAW_PANEL_DOMAIN_PLACEHOLDER", panelDomain)
  .replaceAll("JIGSAW_CLIENT_SECRET_PLACEHOLDER", clientSecret)
  .replaceAll("JIGSAW_ADMIN_EMAIL_PLACEHOLDER", adminEmail)
  .replaceAll("JIGSAW_ADMIN_PASSWORD_PLACEHOLDER", adminPassword);

await fs.writeFile(targetPath, realm, "utf-8");

console.log(`Wrote ${targetPath}`);
