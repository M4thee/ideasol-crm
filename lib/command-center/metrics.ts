import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommandCenterFunnelMetrics,
  CommandCenterMetrics,
  CommandCenterPeriod,
  CommandCenterPeriodValues,
  CommandCenterRankingRow,
} from "./types";

type ClientRow = {
  id: string;
  created_at: string;
  status: string | null;
  lead_source: string | null;
  assigned_user_id: string | null;
  postal_code: string | null;
};

type PostalCodeLocationRow = {
  postal_code: string;
  latitude: number | string;
  longitude: number | string;
};

type MetaLeadRow = {
  id: string;
  client_id: string | null;
  integration_id: string | null;
};

type LeadIntegrationRow = {
  id: string;
  campaign_name: string;
};

type ActivityRow = {
  id: string;
  client_id: string | null;
  created_at: string;
  activity_type: string | null;
};

type CalendarRow = {
  id: string;
  client_id: string | null;
  created_at: string;
  event_at: string;
  event_type: string | null;
  status: string | null;
};

type OfferRow = { id: string; client_id: string | null; created_at: string };
type SaleRow = {
  id: string;
  client_id: string | null;
  seller_id: string | null;
  sale_date: string;
  created_at: string;
  contract_value: number | string | null;
  status: string | null;
};
type ProfileRow = { id: string; display_name: string | null; role: string | null };

type QueryPageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

const COMMAND_CENTER_PERIODS: CommandCenterPeriod[] = ["yesterday", "today", "week", "month", "quarter"];

type CommandCenterDateRange = { start: Date; end: Date };

function mapPeriods<Value>(
  createValue: (period: CommandCenterPeriod) => Value
): CommandCenterPeriodValues<Value> {
  return Object.fromEntries(
    COMMAND_CENTER_PERIODS.map((period) => [period, createValue(period)])
  ) as CommandCenterPeriodValues<Value>;
}

async function fetchAllRows<Row>(
  buildPage: (from: number, to: number) => PromiseLike<QueryPageResult>
): Promise<Row[]> {
  const pageSize = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function normalize(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("pl-PL");
}

function normalizePostalCode(value: unknown) {
  const match = String(value || "").trim().match(/^(\d{2})[-\s]?(\d{3})$/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "0").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedDateToUtc(
  value: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timezone: string
) {
  const intended = Date.UTC(value.year, value.month - 1, value.day, value.hour || 0, value.minute || 0, value.second || 0);
  let guess = intended;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = getZonedParts(new Date(guess), timezone);
    const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += intended - actualWallTime;
  }
  return new Date(guess);
}

function getRanges(now: Date, timezone: string) {
  const current = getZonedParts(now, timezone);
  const dayStart = zonedDateToUtc({ year: current.year, month: current.month, day: current.day }, timezone);
  const previousDay = new Date(Date.UTC(current.year, current.month - 1, current.day - 1));
  const yesterdayStart = zonedDateToUtc(
    { year: previousDay.getUTCFullYear(), month: previousDay.getUTCMonth() + 1, day: previousDay.getUTCDate() },
    timezone
  );
  const localWeekday = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
  const mondayOffset = localWeekday === 0 ? -6 : 1 - localWeekday;
  const monday = new Date(Date.UTC(current.year, current.month - 1, current.day + mondayOffset));
  const weekStart = zonedDateToUtc(
    { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() },
    timezone
  );
  const monthStart = zonedDateToUtc({ year: current.year, month: current.month, day: 1 }, timezone);
  const quarterStartMonth = Math.floor((current.month - 1) / 3) * 3 + 1;
  const quarterStart = zonedDateToUtc({ year: current.year, month: quarterStartMonth, day: 1 }, timezone);
  const nextDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const dayEnd = zonedDateToUtc(
    { year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate() },
    timezone
  );
  const periods: CommandCenterPeriodValues<CommandCenterDateRange> = {
    yesterday: { start: yesterdayStart, end: dayStart },
    today: { start: dayStart, end: dayEnd },
    week: { start: weekStart, end: dayEnd },
    month: { start: monthStart, end: dayEnd },
    quarter: { start: quarterStart, end: dayEnd },
  };
  const queryStart = new Date(Math.min(yesterdayStart.getTime(), quarterStart.getTime()));
  return { dayStart, dayEnd, periods, queryStart };
}

function inRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= start.getTime() && timestamp < end.getTime();
}

export function isCountedCommandCenterSale(row: { status: string | null }) {
  const status = normalize(row.status);
  return !status.includes("anul") && !status.includes("utrac") && !status.includes("rezygn") && !status.includes("nieurat");
}

function isCancelledMeeting(row: CalendarRow) {
  const status = normalize(row.status);
  return status.includes("cancel") || status.includes("anul");
}

function group(values: Array<string | null>, fallback: string) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = value?.trim() || fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pl"));
}

function mapLeadCampaign(
  client: ClientRow,
  metaIntegrationByClient: Map<string, string | null>,
  integrationNames: Map<string, string>
) {
  const source = normalize(client.lead_source);
  if (!source) return { campaign: "Lead doradcy", campaignKind: "advisor" as const };
  if (source === "kalkulatorme") return { campaign: "Kalkulator ME", campaignKind: "calculator" as const };
  if (source === "import ze zdjęcia") return { campaign: "Załatwione z roboty", campaignKind: "photo" as const };
  if (source !== "meta ads") return null;

  const integrationId = metaIntegrationByClient.get(client.id);
  const integrationName = integrationId ? integrationNames.get(integrationId)?.trim() : "";
  const normalizedIntegrationName = normalize(integrationName);
  if (normalizedIntegrationName.includes("arimr")) return { campaign: "ARiMR", campaignKind: "meta" as const };
  if (normalizedIntegrationName.includes("magazyn") || normalizedIntegrationName.includes("kwh")) {
    return { campaign: "ME", campaignKind: "meta" as const };
  }
  const shortenedName = integrationName?.split("|")[0]?.trim() || "Meta Ads";
  return { campaign: shortenedName, campaignKind: "meta" as const };
}

function isLeadMapSource(client: ClientRow) {
  const source = normalize(client.lead_source);
  return !source || source === "meta ads" || source === "kalkulatorme" || source === "import ze zdjęcia";
}

export async function loadCommandCenterMetrics(
  supabase: SupabaseClient,
  timezone = "Europe/Warsaw",
  now = new Date()
): Promise<CommandCenterMetrics> {
  const ranges = getRanges(now, timezone);
  const queryStartIso = ranges.queryStart.toISOString();
  const dayEndIso = ranges.dayEnd.toISOString();

  const [clients, activities, calendarByEventDate, calendarCreated, offers, unfilteredSales, profiles] = await Promise.all([
    fetchAllRows<ClientRow>((from, to) => supabase.from("clients").select("id, created_at, status, lead_source, assigned_user_id, postal_code").gte("created_at", queryStartIso).lt("created_at", dayEndIso).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<ActivityRow>((from, to) => supabase.from("client_activities").select("id, client_id, created_at, activity_type").gte("created_at", queryStartIso).lt("created_at", dayEndIso).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<CalendarRow>((from, to) => supabase.from("calendar_events").select("id, client_id, event_at, event_type, status").gte("event_at", queryStartIso).lt("event_at", dayEndIso).order("event_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<CalendarRow>((from, to) => supabase.from("calendar_events").select("id, client_id, event_at, event_type, status, created_at").gte("created_at", queryStartIso).lt("created_at", dayEndIso).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<OfferRow>((from, to) => supabase.from("client_offers").select("id, client_id, created_at").gte("created_at", queryStartIso).lt("created_at", dayEndIso).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<SaleRow>((from, to) => supabase.from("sales").select("id, client_id, seller_id, sale_date, created_at, contract_value, status").gte("sale_date", queryStartIso).lt("sale_date", dayEndIso).order("sale_date", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<ProfileRow>((from, to) => supabase.from("profiles").select("id, display_name, role").order("id", { ascending: true }).range(from, to)),
  ]);

  const rowsInPeriod = <Row,>(
    rows: Row[],
    period: CommandCenterPeriod,
    dateValue: (row: Row) => string | null | undefined
  ) => {
    const range = ranges.periods[period];
    return rows.filter((row) => inRange(dateValue(row), range.start, range.end));
  };
  const clientsByPeriod = mapPeriods((period) => rowsInPeriod(clients, period, (row) => row.created_at));
  const activitiesByPeriod = mapPeriods((period) => rowsInPeriod(activities, period, (row) => row.created_at));
  const meetingsByCreatedPeriod = mapPeriods((period) => rowsInPeriod(
    calendarCreated.filter((row) => normalize(row.event_type) === "meeting" && !isCancelledMeeting(row)),
    period,
    (row) => row.created_at
  ));
  const callsByPeriod = mapPeriods((period) => rowsInPeriod(
    activities.filter((row) => normalize(row.activity_type) === "phone"),
    period,
    (row) => row.created_at
  ));
  const sales = unfilteredSales.filter(isCountedCommandCenterSale);
  const salesByPeriod = mapPeriods((period) => rowsInPeriod(sales, period, (row) => row.sale_date || row.created_at));

  const mapEligibleClients = clients.filter(isLeadMapSource);
  const metaClientIds = mapEligibleClients.filter((client) => normalize(client.lead_source) === "meta ads").map((client) => client.id);
  const metaClientChunks = Array.from({ length: Math.ceil(metaClientIds.length / 150) }, (_, index) => metaClientIds.slice(index * 150, (index + 1) * 150));
  const postalCodes = Array.from(new Set(mapEligibleClients.map((client) => normalizePostalCode(client.postal_code)).filter((code): code is string => Boolean(code))));
  const postalCodeChunks = Array.from({ length: Math.ceil(postalCodes.length / 150) }, (_, index) => postalCodes.slice(index * 150, (index + 1) * 150));
  const [metaLeadPages, postalCodeLocationPages] = await Promise.all([
    Promise.all(metaClientChunks.map((chunk) =>
      fetchAllRows<MetaLeadRow>((from, to) => supabase
        .from("meta_leads")
        .select("id, client_id, integration_id")
        .in("client_id", chunk)
        .order("id", { ascending: true })
        .range(from, to))
    )),
    Promise.all(postalCodeChunks.map((chunk) =>
      fetchAllRows<PostalCodeLocationRow>((from, to) => supabase
        .from("postal_code_locations")
        .select("postal_code, latitude, longitude")
        .in("postal_code", chunk)
        .order("postal_code", { ascending: true })
        .range(from, to))
    )),
  ]);
  const metaLeads = metaLeadPages.flat();
  const postalCodeLocations = postalCodeLocationPages.flat();
  const integrationIds = Array.from(new Set(metaLeads.map((lead) => lead.integration_id).filter((id): id is string => Boolean(id))));
  const integrationIdChunks = Array.from({ length: Math.ceil(integrationIds.length / 150) }, (_, index) => integrationIds.slice(index * 150, (index + 1) * 150));
  const leadIntegrations = (await Promise.all(integrationIdChunks.map((chunk) =>
    fetchAllRows<LeadIntegrationRow>((from, to) => supabase
      .from("lead_integrations")
      .select("id, campaign_name")
      .in("id", chunk)
      .order("id", { ascending: true })
      .range(from, to))
  ))).flat();
  const metaIntegrationByClient = new Map(metaLeads.map((lead) => [lead.client_id || "", lead.integration_id]));
  const integrationNames = new Map(leadIntegrations.map((integration) => [integration.id, integration.campaign_name]));

  const mappedClients = mapEligibleClients.map((client) => ({ client, campaign: mapLeadCampaign(client, metaIntegrationByClient, integrationNames) }))
    .filter((entry): entry is { client: ClientRow; campaign: NonNullable<ReturnType<typeof mapLeadCampaign>> } => Boolean(entry.campaign));

  const locationSums = new Map<string, { latitude: number; longitude: number; count: number }>();
  postalCodeLocations.forEach((location) => {
    const postalCode = normalizePostalCode(location.postal_code);
    const latitude = numberValue(location.latitude);
    const longitude = numberValue(location.longitude);
    if (!postalCode || !latitude || !longitude) return;
    const current = locationSums.get(postalCode) || { latitude: 0, longitude: 0, count: 0 };
    current.latitude += latitude;
    current.longitude += longitude;
    current.count += 1;
    locationSums.set(postalCode, current);
  });
  const locationMap = new Map(Array.from(locationSums, ([postalCode, location]) => [postalCode, {
    latitude: location.latitude / location.count,
    longitude: location.longitude / location.count,
  }]));
  const leadMapCounts = new Map<string, {
    campaign: string;
    campaignKind: "meta" | "calculator" | "advisor" | "photo";
    counts: CommandCenterPeriodValues<number>;
    postalCode: string;
  }>();
  let validPostalCodes = 0;
  let locatedLeads = 0;
  mappedClients.forEach(({ client, campaign }) => {
    const postalCode = normalizePostalCode(client.postal_code);
    if (!postalCode) return;
    validPostalCodes += 1;
    if (!locationMap.has(postalCode)) return;
    locatedLeads += 1;
    const mapKey = JSON.stringify([postalCode, campaign.campaign]);
    const entry = leadMapCounts.get(mapKey) || {
      campaign: campaign.campaign,
      campaignKind: campaign.campaignKind,
      counts: mapPeriods(() => 0),
      postalCode,
    };
    COMMAND_CENTER_PERIODS.forEach((period) => {
      const range = ranges.periods[period];
      if (inRange(client.created_at, range.start, range.end)) entry.counts[period] += 1;
    });
    leadMapCounts.set(mapKey, entry);
  });
  const leadMapPoints = Array.from(leadMapCounts.values(), ({ campaign, campaignKind, counts, postalCode }) => ({
    campaign,
    campaignKind,
    postalCode,
    latitude: locationMap.get(postalCode)!.latitude,
    longitude: locationMap.get(postalCode)!.longitude,
    ...counts,
  })).sort((a, b) => a.postalCode.localeCompare(b.postalCode, "pl") || a.campaign.localeCompare(b.campaign, "pl"));
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const sumSales = (rows: SaleRow[]) => rows.reduce((sum, row) => sum + numberValue(row.contract_value), 0);

  const leadStats = mapPeriods((period) => {
    const periodClients = clientsByPeriod[period];
    const clientMap = new Map(periodClients.map((client) => [client.id, client]));
    const activitiesByClient = new Map<string, ActivityRow[]>();
    activitiesByPeriod[period].forEach((activity) => {
      if (!activity.client_id || !clientMap.has(activity.client_id)) return;
      const client = clientMap.get(activity.client_id)!;
      if (new Date(activity.created_at).getTime() < new Date(client.created_at).getTime()) return;
      activitiesByClient.set(activity.client_id, [...(activitiesByClient.get(activity.client_id) || []), activity]);
    });
    const firstActivityMinutes = periodClients.flatMap((client) => {
      const firstActivity = (activitiesByClient.get(client.id) || [])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      if (!firstActivity) return [];
      return [(new Date(firstActivity.created_at).getTime() - new Date(client.created_at).getTime()) / 60000];
    });
    return {
      contactedClientIds: new Set(activitiesByClient.keys()),
      contactRate: periodClients.length ? Math.round((activitiesByClient.size / periodClients.length) * 100) : 0,
      averageFirstActivityMinutes: firstActivityMinutes.length
        ? Math.round(firstActivityMinutes.reduce((sum, value) => sum + value, 0) / firstActivityMinutes.length)
        : null,
    };
  });

  const funnel: CommandCenterPeriodValues<CommandCenterFunnelMetrics> = mapPeriods((period) => {
    const periodClients = clientsByPeriod[period];
    const clientIds = new Set(periodClients.map((client) => client.id));
    const periodMeetings = rowsInPeriod(calendarByEventDate, period, (row) => row.event_at);
    const periodOffers = rowsInPeriod(offers, period, (row) => row.created_at);
    return {
      leads: periodClients.length,
      contacted: leadStats[period].contactedClientIds.size,
      meetings: new Set(periodMeetings.filter((row) => normalize(row.event_type) === "meeting" && !isCancelledMeeting(row) && row.client_id && clientIds.has(row.client_id)).map((row) => row.client_id as string)).size,
      offers: new Set(periodOffers.filter((row) => row.client_id && clientIds.has(row.client_id)).map((row) => row.client_id as string)).size,
      sales: new Set(salesByPeriod[period].filter((row) => row.client_id && clientIds.has(row.client_id)).map((row) => row.client_id as string)).size,
    };
  });

  const ranking = mapPeriods((period) => {
    const rankingMap = new Map<string, CommandCenterRankingRow>();
    profiles
      .filter((profile) => ["seller", "manager", "owner", "admin"].includes(normalize(profile.role)))
      .forEach((profile) => rankingMap.set(profile.id, {
        advisorId: profile.id,
        advisorName: profile.display_name || "Doradca",
        leads: 0,
        contactedLeads: 0,
        contactRate: 0,
        sales: 0,
        salesValue: 0,
        conversion: 0,
      }));
    clientsByPeriod[period].forEach((client) => {
      if (!client.assigned_user_id) return;
      const row = rankingMap.get(client.assigned_user_id);
      if (!row) return;
      row.leads += 1;
      if (leadStats[period].contactedClientIds.has(client.id)) row.contactedLeads += 1;
    });
    salesByPeriod[period].forEach((sale) => {
      if (!sale.seller_id) return;
      const profile = profileMap.get(sale.seller_id);
      const row = rankingMap.get(sale.seller_id) || {
        advisorId: sale.seller_id,
        advisorName: profile?.display_name || "Doradca",
        leads: 0,
        contactedLeads: 0,
        contactRate: 0,
        sales: 0,
        salesValue: 0,
        conversion: 0,
      };
      row.sales += 1;
      row.salesValue += numberValue(sale.contract_value);
      rankingMap.set(sale.seller_id, row);
    });
    return Array.from(rankingMap.values()).map((row) => ({
      ...row,
      contactRate: row.leads > 0 ? Math.round((row.contactedLeads / row.leads) * 100) : 0,
      conversion: row.leads > 0 ? Math.round((row.sales / row.leads) * 100) : 0,
    })).filter((row) => row.leads > 0 || row.sales > 0);
  });

  const meetingsToday = calendarByEventDate.filter((row) =>
    normalize(row.event_type) === "meeting" &&
    inRange(row.event_at, ranges.periods.today.start, ranges.periods.today.end)
  );
  const leadCounts = mapPeriods((period) => clientsByPeriod[period].length);
  const contactRates = mapPeriods((period) => leadStats[period].contactRate);
  const averageFirstActivityMinutes = mapPeriods((period) => leadStats[period].averageFirstActivityMinutes);
  const sources = mapPeriods((period) => group(clientsByPeriod[period].map((row) => row.lead_source), "Brak źródła"));
  const statuses = mapPeriods((period) => group(clientsByPeriod[period].map((row) => row.status), "Brak statusu"));
  const salesCounts = mapPeriods((period) => salesByPeriod[period].length);
  const salesValues = mapPeriods((period) => sumSales(salesByPeriod[period]));

  return {
    generatedAt: now.toISOString(),
    leads: {
      ...leadCounts,
      contactedMonth: leadStats.month.contactedClientIds.size,
      contactRateMonth: contactRates.month,
      averageFirstActivityMinutes: averageFirstActivityMinutes.month,
      sources: sources.month,
      statuses: statuses.month,
      contactRateByPeriod: contactRates,
      averageFirstActivityMinutesByPeriod: averageFirstActivityMinutes,
      sourcesByPeriod: sources,
      statusesByPeriod: statuses,
    },
    sales: {
      ...salesCounts,
      valueYesterday: salesValues.yesterday,
      valueToday: salesValues.today,
      valueWeek: salesValues.week,
      valueMonth: salesValues.month,
      valueQuarter: salesValues.quarter,
      valueByPeriod: salesValues,
    },
    funnel: { ...funnel.month, byPeriod: funnel },
    meetings: {
      ...mapPeriods((period) => meetingsByCreatedPeriod[period].length),
      scheduledToday: meetingsToday.filter((row) => !isCancelledMeeting(row)).length,
      upcomingToday: meetingsToday.filter((row) => !isCancelledMeeting(row) && new Date(row.event_at) >= now).length,
    },
    calls: mapPeriods((period) => callsByPeriod[period].length),
    leadMap: {
      points: leadMapPoints,
      validPostalCodes,
      locatedLeads,
    },
    ranking: ranking.month,
    rankingByPeriod: ranking,
    reliability: [
      "Wczoraj oznacza poprzedni dzień kalendarzowy; tydzień, miesiąc i kwartał są liczone od początku bieżącego okresu w strefie urządzenia.",
      "Leady są liczone z rekordów clients według created_at; podjęty lead oznacza co najmniej jedną zarejestrowaną aktywność w tym samym okresie.",
      "Sprzedaż wyklucza statusy anulowane, utracone i rezygnacje; liczba i wartość są liczone według sales.sale_date, a wartość pochodzi z sales.contract_value.",
      "Wykonane telefony są liczone z aktywności client_activities o typie phone; CRM nie rejestruje czasu rozmów.",
      "Spotkania umówione są liczone według daty utworzenia spotkania w kalendarzu; spotkania anulowane są wykluczone.",
      "Mapa pokazuje leady Meta Ads według nazwy integratora, Kalkulator ME, Lead doradcy i Załatwione z roboty; grupuje je po kodzie pocztowym i korzysta z lokalnego katalogu postal_code_locations.",
    ],
  };
}
