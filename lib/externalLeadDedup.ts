import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeLeadPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

export function normalizeLeadEmail(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

export type ExternalLeadMatch = {
  id: string;
  assigned_user_id: string | null;
  status: string | null;
};

type ExternalLeadLookupRow = {
  id: string;
  assigned_user_id: string | null;
  status: string | null;
  phone_dedup_key: string | null;
  email_dedup_key: string | null;
  last_lead_activity_at: string;
  created_at: string;
};

export type IngestExternalLeadInput = {
  source: "meta" | "www";
  externalUid?: string | null;
  businessArea: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  province?: string | null;
  clientType?: string | null;
  assignedUserId?: string | null;
  note?: string | null;
};

export type IngestExternalLeadResult = {
  clientId: string;
  duplicate: boolean;
  assignedUserId: string | null;
  status: string | null;
  matchedBy: "new" | "phone" | "email";
};

export async function findExistingExternalLead(
  supabase: SupabaseClient,
  input: Pick<IngestExternalLeadInput, "businessArea" | "phone" | "email">
): Promise<ExternalLeadMatch | null> {
  const phoneKey = normalizeLeadPhone(input.phone);
  const emailKey = normalizeLeadEmail(input.email);

  if (!phoneKey && !emailKey) return null;

  const selectColumns =
    "id,assigned_user_id,status,phone_dedup_key,email_dedup_key,last_lead_activity_at,created_at";
  let bestMatch: ExternalLeadLookupRow | null = null;

  if (phoneKey) {
    const { data, error } = await supabase
      .from("clients")
      .select(selectColumns)
      .eq("business_area", input.businessArea || "ideasol")
      .eq("phone_dedup_key", phoneKey)
      .order("last_lead_activity_at", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw error;
    const rows = (data ?? []) as ExternalLeadLookupRow[];
    bestMatch =
      (emailKey ? rows.find((row) => row.email_dedup_key === emailKey) : null) ||
      rows[0] ||
      null;
  }

  if (!phoneKey && !bestMatch && emailKey) {
    const { data, error } = await supabase
      .from("clients")
      .select(selectColumns)
      .eq("business_area", input.businessArea || "ideasol")
      .eq("email_dedup_key", emailKey)
      .order("last_lead_activity_at", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    bestMatch = ((data ?? []) as ExternalLeadLookupRow[])[0] || null;
  }

  return bestMatch
    ? {
        id: String(bestMatch.id),
        assigned_user_id: bestMatch.assigned_user_id ? String(bestMatch.assigned_user_id) : null,
        status: bestMatch.status ? String(bestMatch.status) : null,
      }
    : null;
}

export async function ingestExternalLead(
  supabase: SupabaseClient,
  input: IngestExternalLeadInput
): Promise<IngestExternalLeadResult> {
  const { data, error } = await supabase.rpc("ingest_external_lead", {
    p_source: input.source,
    p_external_uid: input.externalUid || null,
    p_business_area: input.businessArea || "ideasol",
    p_full_name: input.fullName || null,
    p_email: normalizeLeadEmail(input.email),
    p_phone: input.phone || null,
    p_postal_code: input.postalCode || null,
    p_province: input.province || null,
    p_client_type: input.clientType || "B2C",
    p_assigned_user_id: input.assignedUserId || null,
    p_note: input.note || null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.client_id) {
    throw new Error("Baza nie zwróciła identyfikatora obsłużonego leada.");
  }

  return {
    clientId: String(row.client_id),
    duplicate: Boolean(row.duplicate),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    status: row.client_status ? String(row.client_status) : null,
    matchedBy: row.matched_by as IngestExternalLeadResult["matchedBy"],
  };
}
