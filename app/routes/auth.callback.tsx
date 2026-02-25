import { redirect } from "react-router";
import { eq } from "drizzle-orm";
import { exchangeCode, getUserInfoFromToken } from "~/lib/auth.server";
import { getSession, commitSession } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { users } from "~/models/schema";
import { generateId } from "~/lib/crypto.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("OAuth error:", error, url.searchParams.get("error_description"));
    return redirect("/auth/login");
  }

  if (!code || !state) {
    return redirect("/auth/login");
  }

  const session = await getSession(request);
  const savedState = session.get("oauth_state") as string | undefined;
  const codeVerifier = session.get("oauth_code_verifier") as string | undefined;

  if (!savedState || state !== savedState || !codeVerifier) {
    console.error("OAuth state mismatch or missing code verifier");
    return redirect("/auth/login");
  }

  try {
    const panelUrl = process.env.PANEL_URL || "http://localhost:5173";
    const redirectUri = `${panelUrl}/auth/callback`;

    const tokens = await exchangeCode(redirectUri, url, codeVerifier, state);
    const userInfo = getUserInfoFromToken(tokens);

    // Determine role from Keycloak realm roles
    const isAdmin = userInfo.roles.includes("admin");
    const role = isAdmin ? "admin" : "user";

    // Upsert user in database
    const existingUser = await db.query.users.findFirst({
      where: eq(users.keycloakId, userInfo.sub),
    });

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update user info on each login
      await db
        .update(users)
        .set({
          email: userInfo.email,
          name: userInfo.name,
          role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    } else {
      userId = generateId();
      await db.insert(users).values({
        id: userId,
        keycloakId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        role,
      });
    }

    // Set session data
    session.set("userId", userId);
    session.set("userRole", role);
    session.set("userName", userInfo.name);
    session.set("userEmail", userInfo.email);

    // Clean up OAuth state
    session.unset("oauth_state");
    session.unset("oauth_code_verifier");

    return redirect("/dashboard", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    return redirect("/auth/login");
  }
}
