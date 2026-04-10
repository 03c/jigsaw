import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "keycloak", "jigsaw-realm.json");
const targetPath = path.join(root, "keycloak", "jigsaw-realm.ci.json");

const panelDomain = process.env.PANEL_DOMAIN || "127.0.0.1:3000";
const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || "ci-test-client-secret";
const adminEmail = process.env.JIGSAW_ADMIN_EMAIL || "admin@ci.local";
const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || "admin";

const realmTemplate = await fs.readFile(sourcePath, "utf-8");

const realm = realmTemplate
  .replaceAll("JIGSAW_PANEL_DOMAIN_PLACEHOLDER", panelDomain)
  .replaceAll("JIGSAW_CLIENT_SECRET_PLACEHOLDER", clientSecret)
  .replaceAll("JIGSAW_ADMIN_EMAIL_PLACEHOLDER", adminEmail)
  .replaceAll("JIGSAW_ADMIN_PASSWORD_PLACEHOLDER", adminPassword);

await fs.writeFile(targetPath, realm, "utf-8");

console.log(`Wrote ${targetPath}`);
