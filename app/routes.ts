import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  // Home - redirects to dashboard or login
  index("routes/home.tsx"),

  // Auth routes (no layout)
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),

  // Dashboard (authenticated users)
  layout("routes/dashboard.tsx", [
    route("dashboard", "routes/dashboard._index.tsx"),
    route("dashboard/sites/new", "routes/dashboard.sites.new.tsx"),
    route("dashboard/sites/:id", "routes/dashboard.sites.$id.tsx"),
    route("dashboard/profile", "routes/dashboard.profile.tsx"),
  ]),

  // Admin (admin role required)
  layout("routes/admin.tsx", [
    route("admin", "routes/admin._index.tsx"),
    route("admin/users", "routes/admin.users.tsx"),
    route("admin/users/:id", "routes/admin.users.$id.tsx"),
    route("admin/sites", "routes/admin.sites.tsx"),
    route("admin/server", "routes/admin.server-mgmt.tsx"),
  ]),
] satisfies RouteConfig;
