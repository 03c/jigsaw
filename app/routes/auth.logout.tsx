import { redirect } from "react-router";
import { getSession, destroySession } from "~/lib/session.server";

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request);

  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
