import * as client from "openid-client";

let _config: client.Configuration | null = null;

/**
 * Get or initialize the OpenID Connect client configuration.
 * Uses the internal Keycloak URL for server-to-server communication.
 */
async function getOIDCConfig(): Promise<client.Configuration> {
  if (_config) return _config;

  const issuerUrl =
    process.env.KEYCLOAK_ISSUER_URL ||
    "http://keycloak:8080/realms/jigsaw";
  const clientId = process.env.KEYCLOAK_CLIENT_ID || "jigsaw-panel";
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || "";

  _config = await client.discovery(
    new URL(issuerUrl),
    clientId,
    clientSecret,
    undefined,
    {
      execute: [client.allowInsecureRequests],
    }
  );

  return _config;
}

/**
 * Build the Keycloak authorization URL for the browser to redirect to.
 * Uses the PUBLIC Keycloak URL since the browser needs to reach it.
 */
export async function getAuthorizationUrl(
  redirectUri: string,
  state: string,
  codeVerifier: string
): Promise<string> {
  const config = await getOIDCConfig();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  // Build the URL using the internal config, then rewrite to public URL
  const authUrl = client.buildAuthorizationUrl(config, params);

  // Replace the internal Keycloak host with the public one
  const publicKeycloakUrl =
    process.env.KEYCLOAK_PUBLIC_URL ||
    process.env.KEYCLOAK_ISSUER_URL ||
    "http://localhost:8080/realms/jigsaw";

  const internalIssuer =
    process.env.KEYCLOAK_ISSUER_URL ||
    "http://keycloak:8080/realms/jigsaw";

  const publicUrl = authUrl.href.replace(internalIssuer, publicKeycloakUrl);
  return publicUrl;
}

/**
 * Exchange the authorization code for tokens (server-to-server via internal URL).
 */
export async function exchangeCode(
  redirectUri: string,
  currentUrl: URL,
  codeVerifier: string,
  expectedState: string
): Promise<client.TokenEndpointResponse> {
  const config = await getOIDCConfig();

  const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState,
  });

  return tokens;
}

/**
 * Extract user info from the ID token claims.
 */
export function getUserInfoFromToken(tokens: client.TokenEndpointResponse): {
  sub: string;
  email: string;
  name: string;
  preferredUsername?: string;
  roles: string[];
} {
  // The tokens object contains an id_token that we can decode
  // openid-client v6 exposes claims via the claims() method on the response
  const record = (tokens as unknown as { claims: () => Record<string, unknown> }).claims();
  if (!record) {
    throw new Error("No claims found in token response");
  }

  // Extract realm roles from Keycloak token
  const realmAccess = record.realm_access as
    | { roles?: string[] }
    | undefined;
  const roles = realmAccess?.roles || [];

  return {
    sub: record.sub as string,
    email: (record.email as string) || "",
    name:
      (record.name as string) ||
      (record.preferred_username as string) ||
      "Unknown",
    preferredUsername: record.preferred_username as string | undefined,
    roles,
  };
}

/**
 * Generate a random PKCE code verifier.
 */
export function generateCodeVerifier(): string {
  return client.randomPKCECodeVerifier();
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
  return client.randomState();
}
