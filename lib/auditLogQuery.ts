import { supabaseAdmin } from "@/lib/supabase/admin";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_LIMIT = 20_000;

export type AuditLogFilters = {
  from: string | null;
  to: string | null;
  userId: string | null;
  eventType: string | null;
  module: string | null;
  search: string | null;
};

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  event_type: string;
  action: string;
  module: string;
  summary: string;
  entity_type: string | null;
  entity_id: string | null;
  client_id: string | null;
  sale_id: string | null;
  offer_id: string | null;
  path: string | null;
  correlation_id: string | null;
  session_id: string | null;
  changed_fields: string[];
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  actor: {
    display_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
  calculation_sent?: boolean;
};

function cleanText(value: string | null, maxLength = 120) {
  const cleaned = String(value || "").trim().slice(0, maxLength);
  return cleaned || null;
}

export function readAuditLogFilters(searchParams: URLSearchParams): AuditLogFilters {
  return {
    from: cleanText(searchParams.get("from"), 30),
    to: cleanText(searchParams.get("to"), 30),
    userId: cleanText(searchParams.get("userId"), 36),
    eventType: cleanText(searchParams.get("eventType"), 60),
    module: cleanText(searchParams.get("module"), 80),
    search: cleanText(searchParams.get("search"), 120),
  };
}

function endOfSelectedDay(value: string) {
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}

type FilterableAuditQuery<T> = {
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
  eq(column: string, value: string): T;
  or(filters: string): T;
};

function applyFilters<T extends FilterableAuditQuery<T>>(query: T, filters: AuditLogFilters) {
  let filteredQuery = query;

  if (filters.from) filteredQuery = filteredQuery.gte("created_at", filters.from);
  if (filters.to) filteredQuery = filteredQuery.lte("created_at", endOfSelectedDay(filters.to));
  if (filters.userId) filteredQuery = filteredQuery.eq("actor_user_id", filters.userId);
  if (filters.eventType) filteredQuery = filteredQuery.eq("event_type", filters.eventType);
  if (filters.module) filteredQuery = filteredQuery.eq("module", filters.module);

  if (filters.search) {
    const safeSearch = filters.search.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim();

    if (safeSearch) {
      filteredQuery = filteredQuery.or(
        `summary.ilike.%${safeSearch}%,entity_id.ilike.%${safeSearch}%,path.ilike.%${safeSearch}%`
      );
    }
  }

  return filteredQuery;
}

async function attachActors(rows: Omit<AuditLogRow, "actor">[]) {
  const actorIds = [
    ...new Set(rows.map((row) => row.actor_user_id).filter(Boolean) as string[]),
  ];
  const actorMap = new Map<string, AuditLogRow["actor"]>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,display_name,email,role")
      .in("id", actorIds);

    for (const profile of profiles || []) {
      actorMap.set(profile.id, {
        display_name: profile.display_name,
        email: profile.email,
        role: profile.role,
      });
    }
  }

  const calculationIds = [
    ...new Set(
      rows
        .filter((row) => row.event_type === "calculation_completed")
        .map((row) => row.correlation_id)
        .filter(Boolean) as string[]
    ),
  ];
  const sentCalculationIds = new Set<string>();

  if (calculationIds.length > 0) {
    const { data: sentEvents } = await supabaseAdmin
      .from("crm_audit_logs")
      .select("correlation_id")
      .eq("event_type", "offer_sent")
      .in("correlation_id", calculationIds);

    for (const event of sentEvents || []) {
      if (event.correlation_id) sentCalculationIds.add(event.correlation_id);
    }
  }

  return rows.map((row) => ({
    ...row,
    actor: row.actor_user_id ? actorMap.get(row.actor_user_id) || null : null,
    calculation_sent:
      row.event_type === "calculation_completed" && row.correlation_id
        ? sentCalculationIds.has(row.correlation_id)
        : undefined,
  })) as AuditLogRow[];
}

export async function getAuditLogs(
  filters: AuditLogFilters,
  options: { page?: number; pageSize?: number; exportLimit?: number } = {}
) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize || AUDIT_PAGE_SIZE));
  const exportLimit = options.exportLimit;
  const fromIndex = exportLimit ? 0 : (page - 1) * pageSize;
  const toIndex = exportLimit ? exportLimit - 1 : fromIndex + pageSize - 1;

  let query = supabaseAdmin
    .from("crm_audit_logs")
    .select("*", { count: "exact" });
  query = applyFilters(query, filters);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(fromIndex, toIndex);

  if (error) throw error;

  const logs = await attachActors((data || []) as Omit<AuditLogRow, "actor">[]);

  return {
    logs,
    count: count || 0,
    page,
    pageSize,
  };
}

export async function getAuditFilterOptions() {
  const [{ data: profiles }, { data: modules }, { data: eventTypes }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id,display_name,email,role")
      .order("display_name", { ascending: true }),
    supabaseAdmin
      .from("crm_audit_logs")
      .select("module")
      .order("module", { ascending: true })
      .limit(1000),
    supabaseAdmin
      .from("crm_audit_logs")
      .select("event_type")
      .order("event_type", { ascending: true })
      .limit(1000),
  ]);

  return {
    users: profiles || [],
    modules: [...new Set((modules || []).map((item) => item.module).filter(Boolean))],
    eventTypes: [
      ...new Set((eventTypes || []).map((item) => item.event_type).filter(Boolean)),
    ],
  };
}
