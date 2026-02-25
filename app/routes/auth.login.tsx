import { redirect } from "react-router";
import {
  getAuthorizationUrl,
  generateCodeVerifier,
  generateState,
} from "~/lib/auth.server";
import { getSession, commitSession } from "~/lib/session.server";

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request);
  const panelUrl = process.env.PANEL_URL || "http://localhost:5173";
  const redirectUri = `${panelUrl}/auth/callback`;

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store PKCE verifier and state in the session for validation on callback
  session.set("oauth_state", state);
  session.set("oauth_code_verifier", codeVerifier);

  const authUrl = await getAuthorizationUrl(redirectUri, state, codeVerifier);

  return redirect(authUrl, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
