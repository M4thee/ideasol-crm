import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTeamsSaleChannelNotification } from "@/lib/microsoftTeams";

type ActivityRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  activity_type: string | null;
  status: string | null;
  contact_type: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type AdvisorStats = {
  userId: string;
  name: string;
  phones: number;
  meetings: number;
  conversion: number;
};

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ą", "a")
    .replaceAll("ć", "c")
    .replaceAll("ę", "e")
    .replaceAll("ł", "l")
    .replaceAll("ń", "n")
    .replaceAll("ó", "o")
    .replaceAll("ś", "s")
    .replaceAll("ż", "z")
    .replaceAll("ź", "z");
}

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

function getPreviousBusinessDate(date: string) {
  let previous = addDaysToDateString(date, -1);

  while (isNonWorkingDayInPoland(previous)) {
    previous = addDaysToDateString(previous, -1);
  }

  return previous;
}

function getTeamConversion(rows: ActivityRow[]) {
  const marketingRows = rows.filter(isMarketingContact);
  const phones = marketingRows.filter(isPhone).length;
  const meetings = marketingRows.filter(isMeetingScheduled).length;

  return phones > 0 ? (meetings / phones) * 100 : 0;
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

function isPhone(row: ActivityRow) {
  return normalizeText(row.activity_type) === "phone";
}

function isEmail(row: ActivityRow) {
  return normalizeText(row.activity_type) === "email";
}

function isSms(row: ActivityRow) {
  return normalizeText(row.activity_type) === "sms";
}

function isMarketingContact(row: ActivityRow) {
  return normalizeText(row.contact_type) === "kontakt marketingowy";
}

function isMeetingScheduled(row: ActivityRow) {
  const status = normalizeText(row.status);
  return status === "umowione spotkanie" || status === "meeting_scheduled";
}

function buildAdvisorStats(rows: ActivityRow[], profiles: ProfileRow[]) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const statsMap = new Map<string, AdvisorStats>();

  rows.filter(isPhone).forEach((row) => {
    const userId = row.created_by || "unknown";
    const profile = profileMap.get(userId);

    const current = statsMap.get(userId) || {
      userId,
      name: profile?.display_name || profile?.email || "Nieznany użytkownik",
      phones: 0,
      meetings: 0,
      conversion: 0,
    };

    current.phones += 1;

    if (isMeetingScheduled(row)) {
      current.meetings += 1;
    }

    current.conversion =
      current.phones > 0 ? Math.round((current.meetings / current.phones) * 100) : 0;

    statsMap.set(userId, current);
  });

  return Array.from(statsMap.values()).sort((a, b) => b.phones - a.phones);
}

function buildTeamsMessage(
  reportDate: string,
  rows: ActivityRow[],
  advisorStats: AdvisorStats[],
  previousBusinessRows: ActivityRow[]
) {
  const marketingRows = rows.filter(isMarketingContact);
  const phones = marketingRows.filter(isPhone).length;
  const emails = marketingRows.filter(isEmail).length;
  const sms = marketingRows.filter(isSms).length;
  const meetings = marketingRows.filter(isMeetingScheduled).length;
  const currentConversionValue = getTeamConversion(rows);
  const previousConversionValue = getTeamConversion(previousBusinessRows);
  const teamConversion = currentConversionValue.toFixed(1).replace(".", ",");
  const conversionComparison = formatConversionComparison(
    currentConversionValue,
    previousConversionValue
  );
  const reportDateLabel = formatDatePl(new Date(`${reportDate}T12:00:00+02:00`));

  const advisorLines = advisorStats.length > 0
    ? advisorStats.flatMap((advisor, index) => [
        `${index + 1}. ${advisor.name}`,
        `   📞 Telefony: ${advisor.phones}`,
        `   📅 Spotkania: ${advisor.meetings}`,
        `   📈 Konwersja: ${advisor.conversion}%`,
        "",
      ])
    : ["Brak telefonów w wybranym dniu."];

  return [
    `📊 Raport kontaktów marketingowych`,
    `📅 ${reportDateLabel}`,
    "",
    "━━━━━━━━━━━━━━",
    "INTERAKCJE",
    "━━━━━━━━━━━━━━",
    `📞 Telefony: ${phones}`,
    `✉️ Maile: ${emails}`,
    `💬 SMS-y: ${sms}`,
    "",
    "━━━━━━━━━━━━━━",
    "SKUTECZNOŚĆ ZESPOŁU",
    "━━━━━━━━━━━━━━",
    `📞 Telefony: ${phones}`,
    `📅 Spotkania: ${meetings}`,
    `📈 Konwersja: ${teamConversion}%`,
    `Porównanie: ${conversionComparison}`,
    "",
    "━━━━━━━━━━━━━━",
    "TELEFONY PER DORADCA",
    "━━━━━━━━━━━━━━",
    ...advisorLines,
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
      .select("id, created_at, created_by, activity_type, status, contact_type")
      .gte("created_at", previousRange.startIso)
      .lte("created_at", endIso);

    if (activitiesError) {
      throw activitiesError;
    }

    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, email, role");

    if (profilesError) {
      throw profilesError;
    }

    const allRows = (activityRows || []) as ActivityRow[];
    const profiles = (profileRows || []) as ProfileRow[];
    const rows = allRows.filter((row) => {
      const createdAt = new Date(row.created_at).getTime();
      return createdAt >= new Date(startIso).getTime() && createdAt <= new Date(endIso).getTime();
    });
    const previousBusinessRows = allRows.filter((row) => {
      const createdAt = new Date(row.created_at).getTime();
      return createdAt >= new Date(previousRange.startIso).getTime() && createdAt <= new Date(previousRange.endIso).getTime();
    });
    const marketingRows = rows.filter(isMarketingContact);
    const advisorStats = buildAdvisorStats(marketingRows, profiles);
    const message = buildTeamsMessage(reportDate, marketingRows, advisorStats, previousBusinessRows);
    const teamsResult = await sendTeamsReport(message);

    return NextResponse.json({
      ok: true,
      reportDate,
      previousBusinessDate,
      rows: marketingRows.length,
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