import { createCookieSessionStorage, redirect } from "react-router";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__jigsaw_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function commitSession(session: Awaited<ReturnType<typeof getSession>>) {
  return sessionStorage.commitSession(session);
}

export async function destroySession(session: Awaited<ReturnType<typeof getSession>>) {
  return sessionStorage.destroySession(session);
}

/**
 * Get the authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getSessionUser(request: Request) {
  const session = await getSession(request);
  const userId = session.get("userId") as string | undefined;
  const userRole = session.get("userRole") as string | undefined;
  const userName = session.get("userName") as string | undefined;
  const userEmail = session.get("userEmail") as string | undefined;

  if (!userId) return null;

  return {
    id: userId,
    role: userRole || "user",
    name: userName || "Unknown",
    email: userEmail || "",
  };
}

/**
 * Require authentication. Redirects to login if not authenticated.
 */
export async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    throw redirect("/auth/login");
  }
  return user;
}

/**
 * Require admin role. Redirects to dashboard if not admin.
 */
export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "admin") {
    throw redirect("/dashboard");
  }
  return user;
}
