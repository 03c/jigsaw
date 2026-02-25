interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "green" | "yellow" | "red" | "gray";
}

const borderColors = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  yellow: "border-l-yellow-500",
  red: "border-l-red-500",
  gray: "border-l-gray-500",
};

export function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${borderColors[color]} p-4`}
    >
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
