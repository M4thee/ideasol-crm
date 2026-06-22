import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTeamsSaleChannelNotification } from "@/lib/microsoftTeams";
import type { ActivityRow, CalendarEventRow, ProfileRow } from "../types";
import {
  getActivityOwnerId,
  getCalendarEventOwnerId,
  getConversationClientKey,
  isAnsweredPhoneActivity,
  isEmailActivity,
  isMeetingCalendarEvent,
  isMeetingScheduled,
  isPhoneActivity,
  isSmsActivity,
  normalizeText,
} from "../utils";

type ReportGroup = "cc" | "advisor";

type DailyUserStats = {
  userId: string;
  name: string;
  phoneCalls: number;
  uniqueClientConversations: number;
  emails: number;
  sms: number;
  meetingsScheduled: number;
  conversionRate: number;
};

type DailyGroupSummary = {
  phoneCalls: number;
  uniqueClientConversations: number;
  emails: number;
  sms: number;
  meetingsScheduled: number;
  conversionRate: number;
  users: DailyUserStats[];
};

type SalesRow = Record<string, unknown>;

type DailySalesSummary = {
  contracts: number;
  pvContracts: number;
  pvKwpTotal: number;
  storageUnits: number;
};

function formatDatePl(date: Date) {
  return date.toLocaleDateString("pl-PL", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getWarsawDateString(date = new Date()) {
  return date.toLocaleDateString("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function addDaysToDateString(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00+02:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWarsawWeekday(dateString: string) {
  return new Date(`${dateString}T12:00:00+02:00`).getDay();
}

function isWeekendInWarsaw(dateString: string) {
  const weekday = getWarsawWeekday(dateString);
  return weekday === 0 || weekday === 6;
}

function getEasterSundayDateString(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isPolishPublicHoliday(dateString: string) {
  const year = Number(dateString.slice(0, 4));
  const easterSunday = getEasterSundayDateString(year);
  const easterMonday = addDaysToDateString(easterSunday, 1);
  const pentecostSunday = addDaysToDateString(easterSunday, 49);
  const corpusChristi = addDaysToDateString(easterSunday, 60);

  const fixedHolidays = new Set([
    `${year}-01-01`,
    `${year}-01-06`,
    `${year}-05-01`,
    `${year}-05-03`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-24`,
    `${year}-12-25`,
    `${year}-12-26`,
  ]);

  return fixedHolidays.has(dateString) ||
    dateString === easterSunday ||
    dateString === easterMonday ||
    dateString === pentecostSunday ||
    dateString === corpusChristi;
}

function isNonWorkingDayInPoland(dateString: string) {
  return isWeekendInWarsaw(dateString) || isPolishPublicHoliday(dateString);
}

function getPreviousBusinessDate(date: string) {
  let previous = addDaysToDateString(date, -1);

  while (isNonWorkingDayInPoland(previous)) {
    previous = addDaysToDateString(previous, -1);
  }

  return previous;
}

function getReportDateFromRequest(request: NextRequest) {
  const url = new URL(request.url);
  const dateFromQuery = url.searchParams.get("date");

  if (dateFromQuery) {
    return dateFromQuery;
  }

  return getPreviousBusinessDate(getWarsawDateString());
}

function getWarsawDateRangeIso(date: string) {
  const start = new Date(`${date}T00:00:00+02:00`);
  const end = new Date(`${date}T23:59:59.999+02:00`);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatKwp(value: number) {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function getSaleOwnerId(row: SalesRow) {
  return String(
    row.seller_id ||
      row.selling_user_id ||
      row.assigned_user_id ||
      row.created_by ||
      ""
  );
}

function getSaleDate(row: SalesRow) {
  return String(row.sale_date || row.sold_at || row.created_at || "");
}

function isInDateRange(value: string, startIso: string, endIso: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= new Date(startIso).getTime() && time <= new Date(endIso).getTime();
}

function getSoldItems(row: SalesRow) {
  const directItems = toArray(row.sold_items);

  if (directItems.length > 0) {
    return directItems;
  }

  const offerData = toRecord(row.offer_data);
  const offerItems = offerData ? toArray(offerData.sold_items || offerData.soldItems) : [];

  if (offerItems.length > 0) {
    return offerItems;
  }

  return [];
}

function getItemText(item: unknown) {
  if (typeof item === "string") {
    return item;
  }

  const record = toRecord(item);

  if (!record) {
    return "";
  }

  return [
    record.type,
    record.category,
    record.name,
    record.label,
    record.title,
    record.product,
    record.description,
    record.model,
  ]
    .filter(Boolean)
    .join(" ");
}

function isPvItem(item: unknown) {
  const text = normalizeText(getItemText(item));
  return text.includes("instalacja pv") || text.includes("fotowoltaika") || /\bpv\b/.test(text);
}

function isStorageItem(item: unknown) {
  const text = normalizeText(getItemText(item));
  return (
    text.includes("magazyn energii") ||
    text.includes("storage") ||
    text.includes("battery") ||
    text.includes("akumulator") ||
    /\bme\b/.test(text)
  );
}

function extractKwpFromText(value: string) {
  const matches = Array.from(value.matchAll(/(\d+(?:[,.]\d+)?)\s*kWp/gi));

  if (matches.length === 0) {
    return 0;
  }

  return matches.reduce((sum, match) => sum + toNumber(match[1]), 0);
}

function getPvKwpFromSale(row: SalesRow) {
  const directPower =
    toNumber(row.pv_power_kwp) ||
    toNumber(row.pvPowerKwp) ||
    toNumber(row.pv_power) ||
    toNumber(row.pvPower) ||
    toNumber(row.system_power_kwp) ||
    toNumber(row.systemPowerKwp);

  if (directPower > 0) {
    return directPower;
  }

  const soldItems = getSoldItems(row);
  const pvItems = soldItems.filter(isPvItem);
  const pvPowerFromItems = pvItems.reduce<number>(
    (sum, item) => sum + extractKwpFromText(getItemText(item)),
    0
  );

  if (pvPowerFromItems > 0) {
    return pvPowerFromItems;
  }

  const offerData = toRecord(row.offer_data);
  const form = offerData ? toRecord(offerData.form) : null;

  return form
    ? toNumber(form.pvPowerKwp) || toNumber(form.pv_power_kwp) || toNumber(form.pvPower) || toNumber(form.pv_power)
    : 0;
}

function getStorageUnitsFromSale(row: SalesRow) {
  const directUnits =
    toNumber(row.storage_units) ||
    toNumber(row.storageUnits) ||
    toNumber(row.energy_storage_units) ||
    toNumber(row.energyStorageUnits);

  if (directUnits > 0) {
    return directUnits;
  }

  const soldItems = getSoldItems(row);
  const storageItems = soldItems.filter(isStorageItem);

  if (storageItems.length > 0) {
    return storageItems.reduce<number>((sum, item) => {
      const record = toRecord(item);
      const quantity = record
        ? toNumber(record.quantity) || toNumber(record.qty) || toNumber(record.count)
        : 0;

      return sum + (quantity > 0 ? quantity : 1);
    }, 0);
  }

  const offerData = toRecord(row.offer_data);
  const form = offerData ? toRecord(offerData.form) : null;
  const hasStorage = form
    ? Boolean(
        form.storageId ||
          form.storage_id ||
          form.storageModel ||
          form.storage_model ||
          toNumber(form.storageCapacityKwh) > 0 ||
          toNumber(form.storage_capacity_kwh) > 0
      )
    : false;

  return hasStorage ? 1 : 0;
}

function summarizeSales(rows: SalesRow[]): DailySalesSummary {
  const pvContracts = rows.filter((row) => getPvKwpFromSale(row) > 0);

  return {
    contracts: rows.length,
    pvContracts: pvContracts.length,
    pvKwpTotal: pvContracts.reduce<number>((sum, row) => sum + getPvKwpFromSale(row), 0),
    storageUnits: rows.reduce<number>((sum, row) => sum + getStorageUnitsFromSale(row), 0),
  };
}

function summarizeSalesByUser(rows: SalesRow[]) {
  const grouped = new Map<string, SalesRow[]>();

  rows.forEach((row) => {
    const userId = getSaleOwnerId(row);

    if (!userId) {
      return;
    }

    const current = grouped.get(userId) || [];
    current.push(row);
    grouped.set(userId, current);
  });

  return new Map(
    Array.from(grouped.entries()).map(([userId, userSales]) => [
      userId,
      summarizeSales(userSales),
    ])
  );
}

function filterSalesByUserGroup(rows: SalesRow[], profiles: ProfileRow[], group: ReportGroup) {
  const userIds = getUserIdsForGroup(profiles, group);
  return rows.filter((row) => userIds.has(getSaleOwnerId(row)));
}

function isMarketingContact(row: ActivityRow) {
  return normalizeText(row.contact_type) === "kontakt marketingowy";
}

function getUserIdsForGroup(profiles: ProfileRow[], group: ReportGroup) {
  return new Set(
    profiles
      .filter((profile) => {
        const role = normalizeText(profile.role);

        if (group === "cc") {
          return role === "cc";
        }

        return ["seller", "manager", "owner", "admin"].includes(role);
      })
      .map((profile) => profile.id)
  );
}

function filterActivitiesByUserGroup(rows: ActivityRow[], profiles: ProfileRow[], group: ReportGroup) {
  const userIds = getUserIdsForGroup(profiles, group);
  return rows.filter((row) => userIds.has(getActivityOwnerId(row)));
}

function filterCalendarEventsByUserGroup(rows: CalendarEventRow[], profiles: ProfileRow[], group: ReportGroup) {
  const userIds = getUserIdsForGroup(profiles, group);
  return rows.filter((row) => userIds.has(getCalendarEventOwnerId(row)));
}

function summarizeDailyGroup(
  rows: ActivityRow[],
  profileMap: Map<string, ProfileRow>,
  calendarEvents: CalendarEventRow[] = []
): DailyGroupSummary {
  const phoneRows = rows.filter(isPhoneActivity);
  const emailRows = rows.filter(isEmailActivity);
  const smsRows = rows.filter(isSmsActivity);
  const interactionRows = rows.filter(
    (row) => isPhoneActivity(row) || isEmailActivity(row) || isSmsActivity(row)
  );

  const scheduledPhoneRows = phoneRows.filter(isMeetingScheduled);
  const scheduledPhoneActivityIds = new Set(
    scheduledPhoneRows.map((row) => row.id).filter(Boolean) as string[]
  );
  const meetingEventRows = calendarEvents
    .filter(isMeetingCalendarEvent)
    .filter((event) => !event.source_activity_id || !scheduledPhoneActivityIds.has(event.source_activity_id));

  const answeredPhoneRows = phoneRows.filter(isAnsweredPhoneActivity);
  const uniqueClientConversations = new Set(
    answeredPhoneRows.map(getConversationClientKey)
  ).size;
  const userConversationClientKeys = new Map<string, Set<string>>();

  const phoneCalls = phoneRows.length;
  const emails = emailRows.length;
  const sms = smsRows.length;
  const meetingsScheduled = scheduledPhoneRows.length + meetingEventRows.length;
  const userMap = new Map<string, DailyUserStats>();

  interactionRows.forEach((row) => {
    const userId = getActivityOwnerId(row);
    const profile = profileMap.get(userId);
    const current = userMap.get(userId) || {
      userId,
      name: profile?.display_name || profile?.email || "Nieznany użytkownik",
      phoneCalls: 0,
      uniqueClientConversations: 0,
      emails: 0,
      sms: 0,
      meetingsScheduled: 0,
      conversionRate: 0,
    };

    if (isPhoneActivity(row)) {
      current.phoneCalls += 1;

      if (isAnsweredPhoneActivity(row)) {
        const clientKey = getConversationClientKey(row);
        const userClientKeys = userConversationClientKeys.get(userId) || new Set<string>();
        userClientKeys.add(clientKey);
        userConversationClientKeys.set(userId, userClientKeys);
        current.uniqueClientConversations = userClientKeys.size;
      }

      if (isMeetingScheduled(row)) {
        current.meetingsScheduled += 1;
      }
    }

    if (isEmailActivity(row)) {
      current.emails += 1;
    }

    if (isSmsActivity(row)) {
      current.sms += 1;
    }

    current.conversionRate = current.phoneCalls > 0
      ? Math.round((current.meetingsScheduled / current.phoneCalls) * 100)
      : 0;

    userMap.set(userId, current);
  });

  meetingEventRows.forEach((event) => {
    const userId = getCalendarEventOwnerId(event);
    const profile = profileMap.get(userId);
    const current = userMap.get(userId) || {
      userId,
      name: profile?.display_name || profile?.email || "Nieznany użytkownik",
      phoneCalls: 0,
      uniqueClientConversations: 0,
      emails: 0,
      sms: 0,
      meetingsScheduled: 0,
      conversionRate: 0,
    };

    current.meetingsScheduled += 1;
    current.conversionRate = current.phoneCalls > 0
      ? Math.round((current.meetingsScheduled / current.phoneCalls) * 100)
      : 0;

    userMap.set(userId, current);
  });

  return {
    phoneCalls,
    uniqueClientConversations,
    emails,
    sms,
    meetingsScheduled,
    conversionRate: phoneCalls > 0 ? Math.round((meetingsScheduled / phoneCalls) * 100) : 0,
    users: Array.from(userMap.values()).sort((a, b) => b.phoneCalls - a.phoneCalls),
  };
}

function formatConversionComparison(currentConversion: number, previousConversion: number) {
  const difference = currentConversion - previousConversion;
  const formatted = Math.abs(difference).toFixed(1).replace(".", ",");

  if (difference > 0) {
    return `🟢 +${formatted} p.p. względem poprzedniego dnia roboczego`;
  }

  if (difference < 0) {
    return `🔴 -${formatted} p.p. względem poprzedniego dnia roboczego`;
  }

  return "⚪ Bez zmian względem poprzedniego dnia roboczego";
}

function buildReportSection(
  title: string,
  summary: DailyGroupSummary,
  previousSummary: DailyGroupSummary,
  emptyRankingText: string,
  salesSummary?: DailySalesSummary,
  salesByUser?: Map<string, DailySalesSummary>
) {
  const conversionComparison = formatConversionComparison(
    summary.conversionRate,
    previousSummary.conversionRate
  );

  const rankingLines = summary.users.length > 0
    ? summary.users.flatMap((user, index) => {
        const userSales = salesByUser?.get(user.userId) || {
          contracts: 0,
          pvContracts: 0,
          pvKwpTotal: 0,
          storageUnits: 0,
        };

        return [
          `${index + 1}. ${user.name}`,
          `   📞 Telefony: ${user.phoneCalls}`,
          `   🗣️ Odbyte rozmowy: ${user.uniqueClientConversations}`,
          `   ✉️ Maile: ${user.emails}`,
          `   💬 SMS-y: ${user.sms}`,
          `   📅 Spotkania: ${user.meetingsScheduled}`,
          `   📈 Konwersja: ${user.conversionRate}%`,
          ...(salesByUser
            ? [
                `   📃 Umowy: ${userSales.contracts}`,
                `   ☀️ PV: ${userSales.pvContracts} umowy, ${formatKwp(userSales.pvKwpTotal)} kWp`,
                `   🔋 ME: ${userSales.storageUnits} szt. ME`,
              ]
            : []),
          "",
        ];
      })
    : [emptyRankingText, ""];

  return [
    "━━━━━━━━━━━━━━",
    title,
    "━━━━━━━━━━━━━━",
    `📞 Telefony: ${summary.phoneCalls}`,
    `🗣️ Odbyte rozmowy: ${summary.uniqueClientConversations}`,
    `✉️ Maile: ${summary.emails}`,
    `💬 SMS-y: ${summary.sms}`,
    `📅 Umówione spotkania: ${summary.meetingsScheduled}`,
    `📈 Konwersja: ${summary.conversionRate}%`,
    `Porównanie: ${conversionComparison}`,
    ...(salesSummary
      ? [
          "",
          `📃 Umowy: ${salesSummary.contracts}`,
          `☀️ PV: ${salesSummary.pvContracts} umowy, ${formatKwp(salesSummary.pvKwpTotal)} kWp w sumie`,
          `🔋 ME: ${salesSummary.storageUnits} szt. ME`,
        ]
      : []),
    "",
    "Ranking:",
    ...rankingLines,
  ];
}

function buildTeamsMessage(
  reportDate: string,
  ccSummary: DailyGroupSummary,
  previousCcSummary: DailyGroupSummary,
  advisorSummary: DailyGroupSummary,
  previousAdvisorSummary: DailyGroupSummary,
  advisorSalesSummary: DailySalesSummary,
  advisorSalesByUser: Map<string, DailySalesSummary>
) {
  const reportDateLabel = formatDatePl(new Date(`${reportDate}T12:00:00+02:00`));

  return [
    "📊 Daily CRM Report",
    `📅 ${reportDateLabel}`,
    "",
    ...buildReportSection(
      "RAPORT CC — KONTAKTY ZDALNE",
      ccSummary,
      previousCcSummary,
      "Brak kontaktów CC w wybranym dniu."
    ),
    "",
    ...buildReportSection(
      "RAPORT DORADCÓW",
      advisorSummary,
      previousAdvisorSummary,
      "Brak aktywności doradców w wybranym dniu.",
      advisorSalesSummary,
      advisorSalesByUser
    ),
  ].join("\n");
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Brakuje NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function sendTeamsReport(message: string) {
  return sendTeamsSaleChannelNotification({
    message,
  });
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const providedSecret = url.searchParams.get("secret");
    const expectedSecret = process.env.REPORTS_CRON_SECRET;
    const userAgent = request.headers.get("user-agent") || "";
    const isVercelCron =
      request.headers.get("x-vercel-cron") === "1" ||
      userAgent.includes("vercel-cron");
    const hasValidSecret = Boolean(expectedSecret && providedSecret === expectedSecret);

    if (!isVercelCron && !hasValidSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const reportDate = getReportDateFromRequest(request);
    const previousBusinessDate = getPreviousBusinessDate(reportDate);
    const { startIso, endIso } = getWarsawDateRangeIso(reportDate);
    const previousRange = getWarsawDateRangeIso(previousBusinessDate);
    const supabase = getSupabaseAdminClient();

    const isManualTest =
      Boolean(url.searchParams.get("date")) ||
      url.searchParams.get("manual") === "1";
    const todayInWarsaw = getWarsawDateString();

    if (!isManualTest && isNonWorkingDayInPoland(todayInWarsaw)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Dzień wolny w Polsce — raport nie został wysłany. Weekend i święta ustawowo wolne są bez raportów Teams.",
        todayInWarsaw,
      });
    }

    const { data: activityRows, error: activitiesError } = await supabase
      .from("client_activities")
      .select("*")
      .gte("created_at", previousRange.startIso)
      .lte("created_at", endIso);

    if (activitiesError) {
      throw activitiesError;
    }

    const { data: calendarEventRows, error: calendarEventsError } = await supabase
      .from("calendar_events")
      .select("id, created_at, created_by, assigned_user_id, source_activity_id, event_type, status, title, event_at")
      .gte("created_at", previousRange.startIso)
      .lte("created_at", endIso);

    if (calendarEventsError) {
      throw calendarEventsError;
    }

    const { data: salesRows, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (salesError) {
      throw salesError;
    }

    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, email, role, manager_id");

    if (profilesError) {
      throw profilesError;
    }

    const profiles = (profileRows || []) as ProfileRow[];
    const profileMap = new Map<string, ProfileRow>(
      profiles.map((profile) => [profile.id, profile])
    );
    const allActivities = (activityRows || []) as ActivityRow[];
    const allCalendarEvents = (calendarEventRows || []) as CalendarEventRow[];
    const allSales = ((salesRows || []) as SalesRow[]).filter((row) =>
      isInDateRange(getSaleDate(row), startIso, endIso)
    );

    const currentActivities = allActivities.filter((row) => {
      const createdAt = new Date(row.created_at || "").getTime();
      return createdAt >= new Date(startIso).getTime() && createdAt <= new Date(endIso).getTime();
    });

    const previousActivities = allActivities.filter((row) => {
      const createdAt = new Date(row.created_at || "").getTime();
      return createdAt >= new Date(previousRange.startIso).getTime() && createdAt <= new Date(previousRange.endIso).getTime();
    });

    const currentCalendarEvents = allCalendarEvents.filter((event) => {
      const createdAt = new Date(event.created_at || "").getTime();
      return createdAt >= new Date(startIso).getTime() && createdAt <= new Date(endIso).getTime();
    });

    const previousCalendarEvents = allCalendarEvents.filter((event) => {
      const createdAt = new Date(event.created_at || "").getTime();
      return createdAt >= new Date(previousRange.startIso).getTime() && createdAt <= new Date(previousRange.endIso).getTime();
    });

    const currentMarketingActivities = currentActivities.filter(isMarketingContact);
    const previousMarketingActivities = previousActivities.filter(isMarketingContact);

    const ccActivities = filterActivitiesByUserGroup(currentMarketingActivities, profiles, "cc");
    const previousCcActivities = filterActivitiesByUserGroup(previousMarketingActivities, profiles, "cc");
    const ccCalendarEvents = filterCalendarEventsByUserGroup(currentCalendarEvents, profiles, "cc");
    const previousCcCalendarEvents = filterCalendarEventsByUserGroup(previousCalendarEvents, profiles, "cc");

    const advisorActivities = filterActivitiesByUserGroup(currentMarketingActivities, profiles, "advisor");
    const previousAdvisorActivities = filterActivitiesByUserGroup(previousMarketingActivities, profiles, "advisor");
    const advisorCalendarEvents = filterCalendarEventsByUserGroup(currentCalendarEvents, profiles, "advisor");
    const previousAdvisorCalendarEvents = filterCalendarEventsByUserGroup(previousCalendarEvents, profiles, "advisor");

    const ccSummary = summarizeDailyGroup(ccActivities, profileMap, ccCalendarEvents);
    const previousCcSummary = summarizeDailyGroup(previousCcActivities, profileMap, previousCcCalendarEvents);
    const advisorSummary = summarizeDailyGroup(advisorActivities, profileMap, advisorCalendarEvents);
    const previousAdvisorSummary = summarizeDailyGroup(previousAdvisorActivities, profileMap, previousAdvisorCalendarEvents);
    const advisorSales = filterSalesByUserGroup(allSales, profiles, "advisor");
    const advisorSalesSummary = summarizeSales(advisorSales);
    const advisorSalesByUser = summarizeSalesByUser(advisorSales);

    const message = buildTeamsMessage(
      reportDate,
      ccSummary,
      previousCcSummary,
      advisorSummary,
      previousAdvisorSummary,
      advisorSalesSummary,
      advisorSalesByUser
    );
    const teamsResult = await sendTeamsReport(message);

    return NextResponse.json({
      ok: true,
      reportDate,
      previousBusinessDate,
      ccSummary,
      advisorSummary,
      advisorSalesSummary,
      advisorSalesByUser: Object.fromEntries(advisorSalesByUser.entries()),
      teamsResult,
      message,
    });
  } catch (error) {
    console.error("Błąd wysyłki dziennego raportu Teams:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Nie udało się wysłać raportu Teams.",
      },
      { status: 500 }
    );
  }
}