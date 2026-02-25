const SITE_WEB_IMAGE_TEMPLATE =
  process.env.SITE_WEB_IMAGE_TEMPLATE || "jigsaw-php:{phpVersion}";
const SITE_DB_IMAGE = process.env.SITE_DB_IMAGE || "mariadb:lts";
const SITE_SFTP_IMAGE = process.env.SITE_SFTP_IMAGE || "atmoz/sftp";

export function resolveWebImage(phpVersion: string): string {
  if (SITE_WEB_IMAGE_TEMPLATE.includes("{phpVersion}")) {
    return SITE_WEB_IMAGE_TEMPLATE.replaceAll("{phpVersion}", phpVersion);
  }

  return `${SITE_WEB_IMAGE_TEMPLATE}:${phpVersion}`;
}

export function resolveDbImage(): string {
  return SITE_DB_IMAGE;
}

export function resolveSftpImage(): string {
  return SITE_SFTP_IMAGE;
}
