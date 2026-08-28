type DashboardWidgetIconName = "calculator" | "calendar" | "sales" | "tasks";

type DashboardWidgetIconProps = {
  name: DashboardWidgetIconName;
  className?: string;
};

const ICON_STYLES: Record<DashboardWidgetIconName, string> = {
  calculator: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  calendar: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  sales: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  tasks: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-200",
};

export default function DashboardWidgetIcon({
  name,
  className = "",
}: DashboardWidgetIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ICON_STYLES[name]} ${className}`}
    >
      {name === "calculator" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2.75" width="14" height="18.5" rx="2.25" />
          <path d="M8 6.5h8v3H8z" />
          <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" strokeWidth="2.6" />
        </svg>
      ) : name === "calendar" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M7 3v4M17 3v4M3 9.5h18" />
          <path d="M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 17h.01M12 17h.01" strokeWidth="2.6" />
        </svg>
      ) : name === "sales" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.5v19" />
          <path d="M17 6.2c-1.15-1-2.65-1.55-4.4-1.55h-1.1c-2.45 0-4.25 1.35-4.25 3.35 0 1.75 1.15 2.65 3.7 3.25l2.2.5c2.45.55 3.6 1.55 3.6 3.25 0 2.05-1.85 3.55-4.45 3.55h-1.1c-1.85 0-3.5-.6-4.7-1.75" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12a2 2 0 0 1 2 2v10l-6 6H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 21v-6h6M8 8h8M8 12h5" />
        </svg>
      )}
    </span>
  );
}
