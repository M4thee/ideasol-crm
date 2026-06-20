

import type {
  ActivityRow,
  AdvisorUserOption,
  CalendarEventRow,
  ManagerTeamOption,
  OfferRow,
  PeriodPreset,
  ProfileRow,
} from "./types";

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

export function formatPercentChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return "—";
  if (previous === 0) return "+100%";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}%`;
}

export function formatNumberChange(current: number, previous: number) {
  if (previous === current) return "—";
  const change = current - previous;
  return `${change > 0 ? "+" : ""}${change}`;
}

export function formatCurrencyChange(current: number, previous: number, inverse = false) {
  const diff = Number(current || 0) - Number(previous || 0);

  if (Math.abs(diff) < 0.01) {
    return { change: "—", changeTone: "neutral" as const };
  }

  const isPositiveBusinessChange = inverse ? diff < 0 : diff > 0;

  return {
    change: `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`,
    changeTone: isPositiveBusinessChange ? ("positive" as const) : ("negative" as const),
  };
}

export function formatGrossLine(value: number) {
  return `Brutto: ${formatCurrency(value)}`;
}

export function getActivityType(row: ActivityRow) {
  return normalizeText(row.activity_type);
}

export function getContactStatus(row: ActivityRow) {
  return normalizeText(row.status || row.phone_status || row.contact_status || row.outcome || row.result);
}

export function isPhoneActivity(row: ActivityRow) {
  return getActivityType(row) === "phone";
}

export function isEmailActivity(row: ActivityRow) {
  return getActivityType(row) === "email";
}

export function isSmsActivity(row: ActivityRow) {
  return getActivityType(row) === "sms";
}

export function isMeetingScheduled(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "umowione spotkanie" || status === "meeting_scheduled";
}

export function isNoAnswer(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "nie odbiera" || status === "no_answer";
}

export function isAnsweredPhoneActivity(row: ActivityRow) {
  return isPhoneActivity(row) && !isNoAnswer(row);
}

export function getConversationClientKey(row: ActivityRow) {
  return row.client_id || row.id || `${row.created_by || row.assigned_user_id || "unknown"}-${row.created_at || "unknown"}`;
}

export function isCallBackRequest(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "prosba o ponowny kontakt" || status === "call_back_request";
}

export function isNotInterested(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "niezainteresowany" || status === "not_interested";
}

export function getActivityOwnerId(row: ActivityRow) {
  return row.created_by || row.user_id || row.owner_id || row.assigned_user_id || "unknown";
}

export function getCalendarEventOwnerId(row: CalendarEventRow) {
  return row.created_by || row.user_id || row.owner_id || row.assigned_user_id || "unknown";
}

export function isMeetingCalendarEvent(row: CalendarEventRow) {
  const eventType = normalizeText(row.event_type);
  const title = normalizeText(row.title);

  return eventType === "meeting" || eventType === "spotkanie" || title.includes("spotkanie");
}

export function getAdvisorActivityOwnerId(row: ActivityRow) {
  return row.assigned_user_id || row.created_by || row.user_id || row.owner_id || "unknown";
}

export function getAdvisorEventOwnerId(row: CalendarEventRow) {
  return row.assigned_user_id || row.created_by || row.user_id || row.owner_id || "unknown";
}

export function getOfferOwnerId(row: OfferRow) {
  return row.seller_id || row.created_by || row.user_id || row.assigned_user_id || row.owner_id || "unknown";
}

export function isOfferSent(row: OfferRow) {
  const status = normalizeText(row.status);
  return Boolean(
    row.sent_at ||
      row.email_sent_at ||
      row.mail_sent_at ||
      status.includes("sent") ||
      status.includes("wyslana") ||
      status.includes("wyslane")
  );
}

export function isCompletedMeetingEvent(row: CalendarEventRow) {
  const status = normalizeText(row.status);
  const title = normalizeText(row.title);
  return (
    status.includes("odbyte") ||
    status.includes("completed") ||
    status.includes("zakoncz") ||
    title.includes("odbyte")
  );
}


export function getAllowedAdvisorUsers(
  profiles: ProfileRow[],
  currentUserId: string,
  currentRole: string
): AdvisorUserOption[] {
  const advisorRoles = new Set(["seller", "manager", "owner", "admin"]);

  return profiles
    .filter((profile) => advisorRoles.has(normalizeText(profile.role)))
    .filter((profile) => {
      const profileRole = normalizeText(profile.role);

      if (currentRole === "admin" || currentRole === "owner") return true;
      if (currentRole === "manager") {
        return (
          profile.id === currentUserId ||
          profile.manager_id === currentUserId ||
          (profileRole === "seller" && profile.manager_id === currentUserId)
        );
      }
      if (currentRole === "seller") return profile.id === currentUserId;
      return false;
    })
    .map((profile) => ({
      id: profile.id,
      name: profile.display_name || profile.email || "Nieznany użytkownik",
      role: normalizeText(profile.role),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function getManagerTeamOptions(
  profiles: ProfileRow[],
  currentUserId: string,
  currentRole: string
): ManagerTeamOption[] {
  const advisorRoles = new Set(["seller", "manager", "owner", "admin"]);
  const visibleAdvisorIds = profiles
    .filter((profile) => advisorRoles.has(normalizeText(profile.role)))
    .map((profile) => profile.id);

  const managerIds = new Set<string>();

  profiles.forEach((profile) => {
    if (normalizeText(profile.role) === "manager") {
      managerIds.add(profile.id);
    }

    if (profile.manager_id) {
      managerIds.add(profile.manager_id);
    }
  });

  if (currentRole === "manager") {
    managerIds.add(currentUserId);
  }

  const teams = Array.from(managerIds)
    .map((managerId) => {
      const manager = profiles.find((profile) => profile.id === managerId);
      const teamMembers = profiles.filter((profile) => profile.manager_id === managerId);
      const memberIds = Array.from(new Set([managerId, ...teamMembers.map((member) => member.id)]));

      return {
        id: managerId,
        name: manager?.display_name || manager?.email || `Zespół ${managerId.slice(0, 8)}`,
        managerId,
        memberIds,
      };
    })
    .filter((team) => {
      if (currentRole === "admin" || currentRole === "owner") return true;
      if (currentRole === "manager") return team.managerId === currentUserId;
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  if (teams.length > 0) return teams;

  if (currentRole === "admin" || currentRole === "owner") {
    return [
      {
        id: "all-teams",
        name: "Wszyscy doradcy / wszystkie zespoły",
        managerId: "all-teams",
        memberIds: visibleAdvisorIds,
      },
    ];
  }

  if (currentRole === "manager") {
    const currentManager = profiles.find((profile) => profile.id === currentUserId);
    const teamMembers = profiles.filter((profile) => profile.manager_id === currentUserId);

    return [
      {
        id: currentUserId,
        name: currentManager?.display_name || currentManager?.email || "Mój zespół",
        managerId: currentUserId,
        memberIds: Array.from(new Set([currentUserId, ...teamMembers.map((member) => member.id)])),
      },
    ];
  }

  return [];
}

export function isSelectedAdvisor(
  userId: string,
  selectedAdvisorId: string,
  allowedAdvisorIds: Set<string>
) {
  if (!allowedAdvisorIds.has(userId)) return false;
  if (selectedAdvisorId === "all") return true;
  return userId === selectedAdvisorId;
}