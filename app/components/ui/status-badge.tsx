const statusColors: Record<string, string> = {
  running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  stopped: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  creating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || statusColors.stopped;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "running"
            ? "bg-green-500 animate-pulse"
            : status === "error"
            ? "bg-red-500"
            : status === "creating"
            ? "bg-yellow-500 animate-pulse"
            : "bg-gray-400"
        }`}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
