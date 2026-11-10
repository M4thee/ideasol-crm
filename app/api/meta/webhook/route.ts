import { NextRequest, NextResponse } from "next/server";
import {
  assignLead,
  attachIntegrationTags,
  findLeadIntegration,
  type LeadIntegration,
} from "@/lib/leadIntegrations";
import {
  buildTeamsDuplicateLeadMessage,
  buildTeamsLeadAssignmentMessage,
  sendTeamsBoardMetaLeadNotification,
  sendTeamsDirectMetaLeadNotification,
  sendTeamsGeneralMetaLeadNotification,
} from "@/lib/microsoftTeams";
import {
  buildTeamsGeneralMetaLeadMessage,
  shouldSendTeamsGeneralMetaLeadNotification,
} from "@/lib/metaLeadGeneralNotification";
import {
  normalizeMetaLead,
  type MetaLeadField,
} from "@/lib/metaLeadNormalization";
import { buildMetaLeadNote } from "@/lib/metaLeadNotes";
import { extractMetaLeadEvents, getMetaLeadPageToken, type MetaLeadEvent } from "@/lib/metaLeadWebhook";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeBusinessArea } from "@/lib/businessAreas";
import {
  findExistingExternalLead,
  ingestExternalLead,
} from "@/lib/externalLeadDedup";

export const runtime = "nodejs";

type MetaLeadResponse = {
  id?: string;
  form_id?: string | number;
  ad_id?: string | number;
  ad_name?: string;
  campaign_id?: string | number;
  campaign_name?: string;
  field_data?: MetaLeadField[];
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

async function fetchMetaLead({ leadgenId, pageId }: MetaLeadEvent) {
  const accessToken = getMetaLeadPageToken(pageId);

  const apiVersion = process.env.META_GRAPH_API_VERSION || "v20.0";
  const fields = [
    "id",
    "form_id",
    "ad_id",
    "ad_name",
    "campaign_id",
    "campaign_name",
    "field_data",
  ].join(",");
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(leadgenId)}?fields=${encodeURIComponent(fields)}`,
    { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Meta Graph API zwróciło ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as MetaLeadResponse;
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

async function countIntegrationLeads(integrationId: string) {
  const { count, error } = await supabaseAdmin
    .from("meta_leads")
    .select("meta_lead_id", { count: "exact", head: true })
    .eq("integration_id", integrationId)
    .not("client_id", "is", null);

  if (error) {
    console.error("[META WEBHOOK] campaign lead count", error);
    return null;
  }

  return count ?? 0;
}

async function sendNotifications(params: {
  integration: LeadIntegration;
  clientId: string;
  clientName: string;
  assignedUser: { id: string; email: string | null; display_name: string | null } | null;
  metaCampaignName: string;
  metaAdName: string;
  campaignLeadCount: number | null;
  duplicate: boolean;
}) {
  const {
    integration,
    clientId,
    clientName,
    assignedUser,
    metaCampaignName,
    metaAdName,
    campaignLeadCount,
    duplicate,
  } = params;

  const crmUrl = `${process.env.NEXT_PUBLIC_CRM_URL || "https://crm.ideasol.pl"}/clients/${encodeURIComponent(clientId)}`;
  const deliveries: Array<{ target: string; promise: Promise<unknown> }> = [];

  if (!duplicate && shouldSendTeamsGeneralMetaLeadNotification(normalizeBusinessArea(integration.business_area))) {
    deliveries.push({
      target: "general-chat",
      promise: sendTeamsGeneralMetaLeadNotification({
        message: buildTeamsGeneralMetaLeadMessage({
          campaignName: metaCampaignName,
          adName: metaAdName,
          campaignLeadCount,
        }),
      }),
    });
  }

  if (integration.notify_assigned_user && assignedUser?.email) {
    deliveries.push(
      {
        target: "assigned-user",
        promise: sendTeamsDirectMetaLeadNotification({
          userEmail: assignedUser.email,
          message: duplicate
            ? buildTeamsDuplicateLeadMessage({
                campaignName: integration.campaign_name,
                clientName,
                crmUrl,
              })
            : buildTeamsLeadAssignmentMessage({
                campaignName: integration.campaign_name,
                clientName,
                crmUrl,
              }),
        }),
      }
    );
  }

  if (integration.notify_owners && assignedUser) {
    deliveries.push(
      {
        target: "board-chat",
        promise: sendTeamsBoardMetaLeadNotification({
          businessArea: normalizeBusinessArea(integration.business_area),
          message: duplicate
            ? buildTeamsDuplicateLeadMessage({
                campaignName: integration.campaign_name,
                clientName,
                crmUrl,
                assignedUserName: assignedUser.display_name || assignedUser.email,
                recipientIsOwner: true,
              })
            : buildTeamsLeadAssignmentMessage({
                campaignName: integration.campaign_name,
                clientName,
                crmUrl,
                assignedUserName: assignedUser.display_name || assignedUser.email,
                recipientIsOwner: true,
              }),
        }),
      }
    );
  }

  const results = await Promise.allSettled(deliveries.map((delivery) => delivery.promise));
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.error(
        `[META WEBHOOK] Teams notification ${deliveries[index]?.target || "unknown"}`,
        result.reason
      );
    }
  }
}

async function processLeadEvent(
  event: MetaLeadEvent,
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

  const metaLead = await fetchMetaLead(event);
  const formId = metaLead?.form_id ? String(metaLead.form_id) : event.formId;
  const integration = await findLeadIntegration("meta", { formId });

  if (!integration) {
    await saveMetaLead(event.leadgenId, {
      raw_payload: metaLead,
      assignment_status: "integration_not_found",
    });
    throw new Error(`Brak aktywnej konfiguracji Meta dla formularza ${formId || "bez ID"}.`);
  }

  const lead = normalizeMetaLead(
    (metaLead?.field_data ?? []) as MetaLeadField[],
    integration.field_mapping ?? {}
  );
  if (!lead.phone) throw new Error("Lead Meta nie zawiera numeru telefonu.");

  const businessArea = normalizeBusinessArea(integration.business_area);
  const existingClient = await findExistingExternalLead(supabaseAdmin, {
    businessArea,
    phone: lead.phone,
    email: lead.email,
  });
  const assignment = existingClient
    ? {
        user: null,
        requestedRule: integration.assignment_rule,
        appliedRule: "none" as const,
        fallbackReason: null,
      }
    : await assignLead(integration, { postalCode: lead.postalCode });
  const note = buildMetaLeadNote({
    campaignName: integration.campaign_name,
    answers: lead.extraAnswers,
  });
  const ingestedLead = await ingestExternalLead(supabaseAdmin, {
    source: "meta",
    externalUid: event.leadgenId,
    businessArea,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    postalCode: lead.postalCode,
    assignedUserId: assignment.user?.id ?? null,
    note,
  });
  const clientId = ingestedLead.clientId;
  await attachIntegrationTags(clientId, integration.tag_names);

  const { data: assignedProfile } = ingestedLead.assignedUserId
    ? await supabaseAdmin
        .from("profiles")
        .select("id,email,display_name")
        .eq("id", ingestedLead.assignedUserId)
        .maybeSingle()
    : { data: null };

  await saveMetaLead(event.leadgenId, {
    integration_id: integration.id,
    client_id: clientId,
    assigned_user_id: ingestedLead.assignedUserId,
    raw_payload: metaLead,
    form_answers: lead,
    assignment_status: ingestedLead.duplicate
      ? `duplicate_${ingestedLead.matchedBy}`
      : assignment.user
        ? `assigned_${assignment.appliedRule}`
        : "unassigned_no_participants",
  });

  const campaignLeadCount = shouldSendTeamsGeneralMetaLeadNotification(
    normalizeBusinessArea(integration.business_area)
  )
    ? await countIntegrationLeads(integration.id)
    : null;

  await sendNotifications({
    integration,
    clientId,
    clientName: lead.fullName || "Lead Meta Ads",
    assignedUser: assignedProfile,
    metaCampaignName: metaLead.campaign_name?.trim() || integration.campaign_name,
    metaAdName: metaLead.ad_name?.trim() || "brak danych",
    campaignLeadCount,
    duplicate: ingestedLead.duplicate,
  });

  return {
    leadgenId: event.leadgenId,
    clientId,
    integration: integration.slug,
    assignedUserId: ingestedLead.assignedUserId,
    assignmentRule: assignment.appliedRule,
    assignmentFallback: assignment.fallbackReason,
    duplicate: ingestedLead.duplicate,
    duplicateMatchedBy: ingestedLead.matchedBy,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const leadEvents = extractMetaLeadEvents(body);
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
