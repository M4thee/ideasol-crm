"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DashboardTourProps = {
  open: boolean;
  onComplete: () => void;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TOUR_STEPS = [
  {
    target: '[data-dashboard-tour-target="sticky-notes"]',
    title: "Dodawaj notatki",
    description:
      "Tutaj możesz dodać notatkę dla siebie, zarządu lub wskazanych osób.",
  },
  {
    target: '[data-dashboard-tour-target="quick-calculator"]',
    title: "Zrób szybką kalkulację",
    description:
      "Szybko policz orientacyjną cenę instalacji — bez zapisywania i wysyłania oferty.",
  },
  {
    target: '[data-dashboard-tour-target="personalize"]',
    title: "Dopasuj pulpit do siebie",
    description:
      "Tutaj zmienisz kolejność widgetów, ich rozmiar i widoczność.",
  },
] as const;

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function DashboardTour({ open, onComplete }: DashboardTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(220);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updateSpotlight = useCallback(() => {
    if (!open) return;

    const target = document.querySelector<HTMLElement>(TOUR_STEPS[stepIndex].target);
    if (!target) {
      setSpotlightRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    setSpotlightRect({
      top: Math.max(SPOTLIGHT_PADDING, rect.top - SPOTLIGHT_PADDING),
      left: Math.max(SPOTLIGHT_PADDING, rect.left - SPOTLIGHT_PADDING),
      width: Math.min(
        rect.width + SPOTLIGHT_PADDING * 2,
        window.innerWidth - SPOTLIGHT_PADDING * 2
      ),
      height: Math.min(
        rect.height + SPOTLIGHT_PADDING * 2,
        window.innerHeight - SPOTLIGHT_PADDING * 2
      ),
    });
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;

    const target = document.querySelector<HTMLElement>(TOUR_STEPS[stepIndex].target);
    target?.classList.add("dashboard-tour-active-target");
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    const animationFrameId = window.requestAnimationFrame(updateSpotlight);
    const settleTimeoutId = window.setTimeout(updateSpotlight, 450);

    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(settleTimeoutId);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
      target?.classList.remove("dashboard-tour-active-target");
    };
  }, [open, stepIndex, updateSpotlight]);

  useEffect(() => {
    if (!open || !tooltipRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setTooltipHeight(entry.contentRect.height);
    });
    observer.observe(tooltipRef.current);
    return () => observer.disconnect();
  }, [open, stepIndex]);

  if (!open) return null;

  const step = TOUR_STEPS[stepIndex];
  const lastStep = stepIndex === TOUR_STEPS.length - 1;
  const tooltipWidth = Math.min(360, typeof window === "undefined" ? 360 : window.innerWidth - 32);
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;

  let tooltipTop = Math.max(16, (viewportHeight - tooltipHeight) / 2);
  let tooltipLeft = Math.max(16, (viewportWidth - tooltipWidth) / 2);

  if (spotlightRect) {
    tooltipLeft = clamp(
      spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2,
      16,
      viewportWidth - tooltipWidth - 16
    );

    const belowTarget = spotlightRect.top + spotlightRect.height + TOOLTIP_GAP;
    const aboveTarget = spotlightRect.top - tooltipHeight - TOOLTIP_GAP;
    tooltipTop = belowTarget + tooltipHeight <= viewportHeight - 16
      ? belowTarget
      : Math.max(16, aboveTarget);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      <div aria-hidden="true" className="fixed inset-0 bg-slate-950/70" />
      {spotlightRect ? (
        <div
          aria-hidden="true"
          className="fixed rounded-2xl border-2 border-emerald-300 ring-4 ring-emerald-300/35 transition-all duration-300"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      ) : null}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-tour-title"
        aria-describedby="dashboard-tour-description"
        className="pointer-events-auto fixed rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/35 transition-[top,left] duration-300 dark:border-slate-700 dark:bg-slate-900"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Krok {stepIndex + 1} z {TOUR_STEPS.length}
          </span>
          <div className="flex gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === stepIndex
                    ? "w-6 bg-emerald-500"
                    : index < stepIndex
                      ? "w-2 bg-emerald-300"
                      : "w-2 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>

        <h2 id="dashboard-tour-title" className="text-xl font-extrabold text-slate-900 dark:text-white">
          {step.title}
        </h2>
        <p id="dashboard-tour-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {step.description}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStepIndex((current) => current - 1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Wstecz
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => {
              if (lastStep) {
                onComplete();
                return;
              }
              setStepIndex((current) => current + 1);
            }}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-400"
          >
            {lastStep ? "Nie pokazuj więcej" : "Dalej"}
          </button>
        </div>
      </div>
    </div>
  );
}
