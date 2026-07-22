import { NextRequest, NextResponse } from "next/server";
import {
  assignLead,
  attachIntegrationTags,
  findLeadIntegration,
  type LeadIntegration,
} from "@/lib/leadIntegrations";
import {
  buildTeamsLeadAssignmentMessage,
  sendTeamsBoardMetaLeadNotification,
  sendTeamsDirectMetaLeadNotification,
} from "@/lib/microsoftTeams";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type MetaLeadField = {
  name?: string;
  values?: string[];
};

type NormalizedMetaLead = {
  fullName: string | null;
  phone: string | null;
  postalCode: string | null;
  extraAnswers: Array<{ label: string; value: string }>;
  rawFieldData: MetaLeadField[];
};

const DEFAULT_FIELD_MAPPING: Record<string, string[]> = {
  fullName: ["full_name", "full name", "imie_i_nazwisko", "imię i nazwisko", "imie"],
  phone: ["phone_number", "phone", "numer_telefonu", "numer telefonu", "telefon"],
  postalCode: [
    "postal_code",
    "postal code",
    "kod_pocztowy",
    "kod pocztowy",
    "kod_pocztowy_inwestycji",
  ],
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function normalizeFieldName(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getFieldValue(fields: MetaLeadField[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeFieldName);
  const field = fields.find((item) =>
    normalizedCandidates.includes(normalizeFieldName(item.name))
  );
  return field?.values?.[0]?.trim() || null;
}

function normalizePostalCode(value: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : value?.trim() || null;
}

function normalizeMetaLead(fields: MetaLeadField[], integration: LeadIntegration) {
  const mapping = { ...DEFAULT_FIELD_MAPPING, ...(integration.field_mapping ?? {}) };
  const mappedNames = new Set(
    Object.values(mapping).flat().map((fieldName) => normalizeFieldName(fieldName))
  );

  return {
    fullName: getFieldValue(fields, mapping.fullName ?? DEFAULT_FIELD_MAPPING.fullName),
    phone: getFieldValue(fields, mapping.phone ?? DEFAULT_FIELD_MAPPING.phone),
    postalCode: normalizePostalCode(
      getFieldValue(fields, mapping.postalCode ?? DEFAULT_FIELD_MAPPING.postalCode)
    ),
    extraAnswers: fields
      .filter((field) => !mappedNames.has(normalizeFieldName(field.name)))
      .map((field) => ({
        label: field.name || "Pole formularza",
        value: field.values?.join(", ") || "brak danych",
      })),
    rawFieldData: fields,
  } satisfies NormalizedMetaLead;
}

type MetaWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: { leadgen_id?: string | number; form_id?: string | number };
    }>;
  }>;
};

function extractLeadEvents(body: unknown) {
  const events: Array<{ leadgenId: string; formId: string | null }> = [];
  const webhookBody = body as MetaWebhookBody;

  for (const entry of webhookBody?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.value?.leadgen_id) {
        events.push({
          leadgenId: String(change.value.leadgen_id),
          formId: change.value.form_id ? String(change.value.form_id) : null,
        });
      }
    }
  }

  return events;
}

async function fetchMetaLead(leadgenId: string) {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Brakuje META_PAGE_ACCESS_TOKEN.");

  const apiVersion = process.env.META_GRAPH_API_VERSION || "v20.0";
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Meta Graph API zwróciło ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function saveMetaLead(
  leadgenId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabaseAdmin.from("meta_leads").upsert(
    {
      meta_lead_id: leadgenId,
      ...values,
    },
    { onConflict: "meta_lead_id" }
  );

  if (error) throw error;
}

async function findExistingClientId(leadgenId: string) {
  const { data, error } = await supabaseAdmin
    .from("meta_leads")
    .select("client_id")
    .eq("meta_lead_id", leadgenId)
    .maybeSingle();

  if (error) throw error;
  return data?.client_id ? String(data.client_id) : null;
}

async function createClient(
  lead: NormalizedMetaLead,
  integration: LeadIntegration,
  assignedUserId: string | null
) {
  const notes = [
    `Lead z ${integration.name}.`,
    `Kampania: ${integration.campaign_name}`,
    ...lead.extraAnswers.map((answer) => `${answer.label}: ${answer.value}`),
  ].join("\n");

  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      full_name: lead.fullName || "Lead Meta Ads",
      phone: lead.phone,
      postal_code: lead.postalCode,
      status: assignedUserId ? "Przypisany" : "Nowy lead",
      assigned_user_id: assignedUserId,
      lead_source: "Meta Ads",
    })
    .select("id")
    .single();

  if (error) throw error;

  if (notes) {
    const { error: noteError } = await supabaseAdmin.from("client_notes").insert({
      client_id: data.id,
      content: notes,
      created_by: null,
    });

    if (noteError) throw noteError;
  }

  await attachIntegrationTags(data.id, integration.tag_names);
  return String(data.id);
}

async function sendNotifications(params: {
  integration: LeadIntegration;
  clientId: string;
  clientName: string;
  assignedUser: { id: string; email: string | null; display_name: string | null } | null;
}) {
  const { integration, clientId, clientName, assignedUser } = params;
  if (!assignedUser) return;

  const crmUrl = `${process.env.NEXT_PUBLIC_CRM_URL || "https://crm.ideasol.pl"}/clients/${encodeURIComponent(clientId)}`;
  const deliveries: Array<Promise<unknown>> = [];

  if (integration.notify_assigned_user && assignedUser.email) {
    deliveries.push(
      sendTeamsDirectMetaLeadNotification({
        userEmail: assignedUser.email,
        message: buildTeamsLeadAssignmentMessage({
          campaignName: integration.campaign_name,
          clientName,
          crmUrl,
        }),
      })
    );
  }

  if (integration.notify_owners) {
    deliveries.push(
      sendTeamsBoardMetaLeadNotification({
        message: buildTeamsLeadAssignmentMessage({
          campaignName: integration.campaign_name,
          clientName,
          crmUrl,
          assignedUserName: assignedUser.display_name || assignedUser.email,
          recipientIsOwner: true,
        }),
      })
    );
  }

  const results = await Promise.allSettled(deliveries);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[META WEBHOOK] Teams notification", result.reason);
    }
  }
}

async function processLeadEvent(
  event: { leadgenId: string; formId: string | null },
  webhookBody: unknown
) {
  const existingClientId = await findExistingClientId(event.leadgenId);
  if (existingClientId) {
    return { leadgenId: event.leadgenId, clientId: existingClientId, duplicate: true };
  }

  await saveMetaLead(event.leadgenId, {
    raw_payload: webhookBody,
    assignment_status: "received",
  });

  const metaLead = await fetchMetaLead(event.leadgenId);
  const formId = event.formId || (metaLead?.form_id ? String(metaLead.form_id) : null);
  const integration = await findLeadIntegration("meta", { formId });

  if (!integration) {
    await saveMetaLead(event.leadgenId, {
      raw_payload: metaLead,
      assignment_status: "integration_not_found",
    });
    throw new Error(`Brak aktywnej konfiguracji Meta dla formularza ${formId || "bez ID"}.`);
  }

  const lead = normalizeMetaLead((metaLead?.field_data ?? []) as MetaLeadField[], integration);
  if (!lead.phone) throw new Error("Lead Meta nie zawiera numeru telefonu.");

  const assignment = await assignLead(integration, { postalCode: lead.postalCode });
  const clientId = await createClient(lead, integration, assignment.user?.id ?? null);

  await saveMetaLead(event.leadgenId, {
    integration_id: integration.id,
    client_id: clientId,
    assigned_user_id: assignment.user?.id ?? null,
    raw_payload: metaLead,
    form_answers: lead,
    assignment_status: assignment.user
      ? `assigned_${assignment.appliedRule}`
      : "unassigned_no_participants",
  });

  await sendNotifications({
    integration,
    clientId,
    clientName: lead.fullName || "Lead Meta Ads",
    assignedUser: assignment.user,
  });

  return {
    leadgenId: event.leadgenId,
    clientId,
    integration: integration.slug,
    assignedUserId: assignment.user?.id ?? null,
    assignmentRule: assignment.appliedRule,
    assignmentFallback: assignment.fallbackReason,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const leadEvents = extractLeadEvents(body);
  const processedLeads = [];

  const { error: logError } = await supabaseAdmin.from("system_logs").insert({
    source: "meta_webhook",
    message: "Webhook received",
    payload: body,
  });
  if (logError) console.error("[META WEBHOOK] system_logs", logError);

  for (const event of leadEvents) {
    try {
      processedLeads.push(await processLeadEvent(event, body));
    } catch (error) {
      console.error(`[META WEBHOOK] ${event.leadgenId}`, error);
      await saveMetaLead(event.leadgenId, {
        raw_payload: body,
        assignment_status: "error",
      }).catch((saveError) => console.error("[META WEBHOOK] error status", saveError));
    }
  }

  return NextResponse.json({
    success: true,
    received: leadEvents.length,
    processedLeads,
  });
}
