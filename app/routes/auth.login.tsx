import { redirect } from "react-router";
import {
  getAuthorizationUrl,
  generateCodeVerifier,
  generateState,
} from "~/lib/auth.server";
import { getSession, commitSession } from "~/lib/session.server";

const AUTH_LOGIN_UNAVAILABLE_BODY =
  "Authentication is temporarily unavailable. Keycloak may still be starting. Please try again in 30 seconds.";

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request);
  const panelUrl = process.env.PANEL_URL || "http://localhost:5173";
  const redirectUri = `${panelUrl}/auth/callback`;

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store PKCE verifier and state in the session for validation on callback
  session.set("oauth_state", state);
  session.set("oauth_code_verifier", codeVerifier);

  if (
    process.env.ALLOW_E2E_503_HOOK === "true" &&
    new URL(request.url).searchParams.has("e2e_503")
  ) {
    return new Response(AUTH_LOGIN_UNAVAILABLE_BODY, { status: 503 });
  }

  try {
    const authUrl = await getAuthorizationUrl(redirectUri, state, codeVerifier);

    return redirect(authUrl, {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (err) {
    console.error("OAuth login initialization error:", err);
    return new Response(AUTH_LOGIN_UNAVAILABLE_BODY, { status: 503 });
  }
}
