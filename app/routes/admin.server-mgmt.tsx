import { redirect } from "react-router";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  return redirect("/admin");
}
