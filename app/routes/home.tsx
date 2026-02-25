import { redirect } from "react-router";
import { getSessionUser } from "~/lib/session.server";

export async function loader({ request }: { request: Request }) {
  const user = await getSessionUser(request);

  if (user) {
    return redirect("/dashboard");
  }

  return redirect("/auth/login");
}

export default function Home() {
  return null;
}
