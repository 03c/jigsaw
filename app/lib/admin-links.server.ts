function isLocalHost(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export function getAdminLinks(requestUrl: string): {
  keycloakUrl: string;
  traefikUrl: string;
} {
  const panelHost = new URL(requestUrl).host;

  const keycloakUrl =
    process.env.KEYCLOAK_CONSOLE_URL ||
    (isLocalHost(panelHost)
      ? "http://localhost:8080"
      : `https://auth.${panelHost}`);

  const traefikUrl =
    process.env.TRAEFIK_DASHBOARD_URL ||
    (isLocalHost(panelHost)
      ? "http://localhost:8081/dashboard/"
      : `https://traefik.${panelHost}/dashboard/`);

  return { keycloakUrl, traefikUrl };
}
