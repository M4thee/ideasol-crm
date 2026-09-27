import { NextResponse } from "next/server";
import { normalizeMetaLead, type MetaLeadField } from "@/lib/metaLeadNormalization";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type StoredMetaLead = {
  meta_lead_id: string;
  client_id: string;
  integration_id: string | null;
  raw_payload: {
    campaign_name?: string;
    form_id?: string | number;
    field_data?: MetaLeadField[];
  } | null;
  form_answers: {
    fullName?: string | null;
    email?: string | null;
  } | null;
};

type ClientContact = {
  id: string;
  full_name: string | null;
  email: string | null;
};

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) return null;

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") return null;
  return profile;
}

function isMissingMetaLeadName(value: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "lead meta ads" ||
    normalized === "meta ads lead"
  );
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const clientResults = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("id,full_name,email")
        .eq("lead_source", "Meta Ads")
        .eq("full_name", "Lead Meta Ads")
        .limit(1000),
      supabaseAdmin
        .from("clients")
        .select("id,full_name,email")
        .eq("lead_source", "Meta Ads")
        .eq("full_name", "Meta Ads Lead")
        .limit(1000),
      supabaseAdmin
        .from("clients")
        .select("id,full_name,email")
        .eq("lead_source", "Meta Ads")
        .is("full_name", null)
        .limit(1000),
    ]);

    const clientsError = clientResults.find((result) => result.error)?.error;
    if (clientsError) throw clientsError;

    const clientsById = new Map<string, ClientContact>();
    for (const result of clientResults) {
      for (const client of (result.data ?? []) as ClientContact[]) {
        clientsById.set(client.id, client);
      }
    }
    const clientRows = [...clientsById.values()];
    if (clientRows.length === 0) {
      return NextResponse.json({ repairedNames: 0, repairedEmails: 0, unresolved: [] });
    }

    const clientIds = clientRows.map((client) => client.id);
    const { data: metaLeads, error: metaLeadsError } = await supabaseAdmin
      .from("meta_leads")
      .select("meta_lead_id,client_id,integration_id,raw_payload,form_answers")
      .in("client_id", clientIds)
      .not("client_id", "is", null)
      .limit(1000);

    if (metaLeadsError) throw metaLeadsError;

    const integrationIds = [
      ...new Set(
        (metaLeads ?? [])
          .map((lead) => lead.integration_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const integrationsResult = integrationIds.length
      ? await supabaseAdmin
          .from("lead_integrations")
          .select("id,field_mapping")
          .in("id", integrationIds)
      : { data: [], error: null };

    if (integrationsResult.error) throw integrationsResult.error;

    const fieldMappings = new Map(
      (integrationsResult.data ?? []).map((integration) => [
        integration.id,
        (integration.field_mapping ?? {}) as Record<string, string[]>,
      ])
    );
    let repairedNames = 0;
    let repairedEmails = 0;
    const unresolved = new Map<string, { campaignName: string; formId: string }>();

    for (const storedLead of (metaLeads ?? []) as StoredMetaLead[]) {
      const client = clientsById.get(storedLead.client_id);
      if (!client || !isMissingMetaLeadName(client.full_name)) continue;

      const normalizedLead = normalizeMetaLead(
        storedLead.raw_payload?.field_data ?? [],
        storedLead.integration_id
          ? fieldMappings.get(storedLead.integration_id) ?? {}
          : {}
      );
      const recoveredName =
        normalizedLead.fullName?.trim() || storedLead.form_answers?.fullName?.trim() || null;
      const recoveredEmail =
        normalizedLead.email?.trim() || storedLead.form_answers?.email?.trim() || null;
      const clientPatch: Record<string, string> = {};

      if (recoveredName) clientPatch.full_name = recoveredName;
      if (!client.email?.trim() && recoveredEmail) clientPatch.email = recoveredEmail;

      if (Object.keys(clientPatch).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from("clients")
          .update(clientPatch)
          .eq("id", client.id);

        if (updateError) throw updateError;
        if (clientPatch.full_name) repairedNames += 1;
        if (clientPatch.email) repairedEmails += 1;
      }

      if (!recoveredName) {
        const campaignName =
          storedLead.raw_payload?.campaign_name?.trim() || "Nieznana kampania";
        const formId = String(storedLead.raw_payload?.form_id ?? "brak ID formularza");
        unresolved.set(`${campaignName}:${formId}`, { campaignName, formId });
      }
    }

    return NextResponse.json({
      repairedNames,
      repairedEmails,
      unresolved: [...unresolved.values()],
    });
  } catch (error) {
    console.error("[META LEAD CONTACT REPAIR]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się naprawić danych kontaktowych leadów Meta.",
      },
      { status: 500 }
    );
  }
}
