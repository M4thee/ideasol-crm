type ResultPanelFocusToggleProps = {
  expanded: boolean;
  onToggle: () => void;
};

export default function ResultPanelFocusToggle({
  expanded,
  onToggle,
}: ResultPanelFocusToggleProps) {
  const label = expanded
    ? "Pokaż kalkulator"
    : "Rozwiń wyniki na pełny ekran";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="absolute left-0 top-1/2 z-30 flex h-24 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-l-[18px] rounded-r-md border border-slate-600 bg-slate-800 text-slate-100 shadow-lg shadow-slate-950/30 transition hover:w-10 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-100 dark:border-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600 dark:focus:ring-offset-slate-950"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 32"
        className={`${expanded ? "rotate-180" : "rotate-0"} h-10 w-6 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
        fill="none"
      >
        <path
          d="M13 4L5 16L13 28"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
