import { Link, useLocation } from "react-router";

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/dashboard/sites/new", label: "New Site", icon: "plus" },
  { href: "/dashboard/profile", label: "Profile", icon: "user" },
];

const adminItems = [
  { href: "/admin", label: "Admin Overview", icon: "shield" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/sites", label: "All Sites", icon: "globe" },
  { href: "/admin/server", label: "Server", icon: "server" },
];

const icons: Record<string, string> = {
  grid: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
  plus: "M12 4v16m-8-8h16",
  user: "M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z",
  shield: "M12 2L3 7v5c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z",
  users: "M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm-8 0c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5c0-2.3-4.7-3.5-7-3.5zm8 0c-.3 0-.6 0-.9.1 1.1.8 1.9 1.9 1.9 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z",
  globe: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 17.9C7.1 19.4 4 16 4 12c0-.6.1-1.2.2-1.8L8 14v1c0 1.1.9 2 2 2v1.9zm6.9-2.5c-.3-.8-1-1.4-1.9-1.4h-1v-3c0-.6-.4-1-1-1H9v-2h2c.6 0 1-.4 1-1V7h2c1.1 0 2-.9 2-2v-.4c2.9 1.4 5 4.5 5 7.9 0 2.8-1.2 5.3-3.1 7z",
  server: "M4 1h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2zm0 10h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2zM6 5h.01M6 15h.01",
};

function NavIcon({ name }: { name: string }) {
  const d = icons[name] || icons.grid;
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const location = useLocation();

  function isActive(href: string) {
    if (href === "/dashboard" || href === "/admin") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  }

  return (
    <aside className="w-64 bg-gray-900 text-gray-100 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <Link to="/dashboard" className="text-xl font-bold tracking-tight">
          Jigsaw
        </Link>
        <p className="text-xs text-gray-400 mt-1">Hosting Control Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Sites
        </p>
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(item.href)
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        ))}

        {user.role === "admin" && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-2">
              Administration
            </p>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
        <Link
          to="/auth/logout"
          className="mt-3 block text-center text-xs text-gray-400 hover:text-white transition-colors py-1"
        >
          Sign out
        </Link>
      </div>
    </aside>
  );
}
