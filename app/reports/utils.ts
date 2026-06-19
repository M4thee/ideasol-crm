

import type { PeriodPreset } from "./types";

export function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;
}

export function formatPercent(value: number) {
  return `${Number.isFinite(value) ? Math.round(value) : 0}%`;
}

export function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function netFromGross(gross: number, vatRate = 0.08) {
  return gross / (1 + vatRate);
}

export function grossFromNet(net: number, vatRate = 0.08) {
  return net * (1 + vatRate);
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPresetRange(preset: PeriodPreset) {
  const today = new Date();
  const from = new Date(today);

  if (preset === "day") {
    return {
      from: toDateInputValue(today),
      to: toDateInputValue(today),
    };
  }

  if (preset === "week") {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    from.setDate(today.getDate() + mondayOffset);
  }

  if (preset === "month") {
    from.setDate(1);
  }

  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    from.setMonth(quarterStartMonth, 1);
  }

  if (preset === "year") {
    from.setMonth(0, 1);
  }

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(today),
  };
}

export function getDateRangeBoundaries(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00.000`);
  const end = new Date(`${dateTo}T23:59:59.999`);

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getPreviousDateRange(dateFrom: string, dateTo: string) {
  const current = getDateRangeBoundaries(dateFrom, dateTo);
  const durationMs = current.end.getTime() - current.start.getTime();
  const previousEnd = new Date(current.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    start: previousStart,
    end: previousEnd,
    startIso: previousStart.toISOString(),
    endIso: previousEnd.toISOString(),
    fromIso: previousStart.toISOString(),
    toIso: previousEnd.toISOString(),
  };
}

export function getChangePercent(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function getChangeTone(current: number, previous: number): "positive" | "negative" | "neutral" {
  if (current > previous) return "positive";
  if (current < previous) return "negative";
  return "neutral";
}

export function getChangeLabel(current: number, previous: number) {
  const change = getChangePercent(current, previous);
  if (change > 0) return `+${change}%`;
  return `${change}%`;
}