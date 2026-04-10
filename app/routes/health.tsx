/**
 * Lightweight health check for load balancers and CI smoke tests.
 * No default UI export — React Router serves the loader Response directly (resource request).
 */
export async function loader() {
  return Response.json({ status: "ok", service: "jigsaw" });
}
