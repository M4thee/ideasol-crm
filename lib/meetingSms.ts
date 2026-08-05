import { createClient } from "@supabase/supabase-js";
import {
  canSendAutomaticSmsToRecipient,
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  sendSmsApiMessage,
} from "@/lib/smsapi";
import { getConfiguredSmsSender } from "@/lib/smsSender";
import {
  formatSmsAutomationDateTime,
  getBaseSmsAutomationValues,
  renderSmsAutomationTemplate,
  type SmsAutomation,
} from "@/lib/automaticSms";
import {
  getActiveSmsAutomations,
  getSmsAutomationById,
} from "@/lib/automaticSmsServer";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

type CalendarEventSmsData = {
  id: string;
  client_id: string | null;
  assigned_user_id: string | null;
  event_at: string | null;
  event_type: string | null;
  title: string | null;
};

type ClientSmsData = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  contact_phone: string | null;
};

type AdvisorSmsData = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
};

const IDEASOL_HOTLINE_PHONE = "41 202 02 38";

export type SendMeetingSmsInput = {
  calendarEventId: string;
  triggeredByUserId?: string | null;
  force?: boolean;
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Brak konfiguracji Supabase service role dla SMS spotkań.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getClientPhone(client: ClientSmsData) {
  return normalizePolishPhoneNumber(client.phone || client.contact_phone || "");
}

function getAdvisorName(advisor: AdvisorSmsData | null) {
  const displayName = advisor?.display_name?.trim() || "";

  if (!displayName) {
    return "doradca IdeaSol";
  }

  return displayName.split(/\s+/)[0] || "doradca IdeaSol";
}

function getAdvisorPhone(advisor: AdvisorSmsData | null) {
  return advisor?.phone?.trim() || IDEASOL_HOTLINE_PHONE;
}

async function loadMeetingSmsData(params: {
  supabaseAdmin: SupabaseAdminClient;
  calendarEventId: string;
}) {
  const { supabaseAdmin, calendarEventId } = params;

  const { data: eventData, error: eventError } = await supabaseAdmin
    .from("calendar_events")
    .select("id, client_id, assigned_user_id, event_at, event_type, title")
    .eq("id", calendarEventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(`Nie udało się pobrać spotkania do SMS: ${eventError.message}`);
  }

  if (!eventData) {
    throw new Error("Nie znaleziono spotkania do SMS.");
  }

  const event = eventData as CalendarEventSmsData;

  if (event.event_type !== "meeting") {
    throw new Error("SMS spotkaniowy można wysłać tylko dla wydarzenia typu meeting.");
  }

  if (!event.client_id) {
    throw new Error("Spotkanie nie ma przypisanego klienta do SMS.");
  }

  if (!event.event_at) {
    throw new Error("Spotkanie nie ma daty do SMS.");
  }

  const { data: clientData, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, company_name, phone, contact_phone")
    .eq("id", event.client_id)
    .maybeSingle();

  if (clientError) {
    throw new Error(`Nie udało się pobrać klienta do SMS: ${clientError.message}`);
  }

  if (!clientData) {
    throw new Error("Nie znaleziono klienta do SMS.");
  }

  const client = clientData as ClientSmsData;
  let advisor: AdvisorSmsData | null = null;

  if (event.assigned_user_id) {
    const { data: advisorData, error: advisorError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, phone")
      .eq("id", event.assigned_user_id)
      .maybeSingle();

    if (advisorError) {
      throw new Error(`Nie udało się pobrać doradcy do SMS: ${advisorError.message}`);
    }

    advisor = advisorData ? (advisorData as AdvisorSmsData) : null;
  }

  return {
    event,
    client,
    advisor,
  };
}

async function hasSmsAlreadyBeenSent(params: {
  supabaseAdmin: SupabaseAdminClient;
  calendarEventId: string;
  messageType: string;
}) {
  const { data, error } = await params.supabaseAdmin
    .from("sms_messages")
    .select("id")
    .eq("meeting_id", params.calendarEventId)
    .eq("message_type", params.messageType)
    .in("status", ["pending", "sent"])
    .limit(1);

  if (error) {
    throw new Error(`Nie udało się sprawdzić historii SMS spotkania: ${error.message}`);
  }

  return Boolean(data?.length);
}

async function sendMeetingSms(params: SendMeetingSmsInput & {
  automation: SmsAutomation;
}) {
  const calendarEventId = String(params.calendarEventId || "").trim();

  if (!calendarEventId) {
    throw new Error("Brak ID spotkania do wysyłki SMS.");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { event, client, advisor } = await loadMeetingSmsData({
    supabaseAdmin,
    calendarEventId,
  });

  const recipientPhone = getClientPhone(client);

  if (!recipientPhone) {
    throw new Error("Klient nie ma numeru telefonu do SMS.");
  }

  if (!canSendAutomaticSmsToRecipient(recipientPhone)) {
    return {
      ok: true,
      skipped: true,
      reason: "Tryb testowy: numer klienta nie jest numerem testowym SMS.",
      calendarEventId,
      messageType: params.automation.message_type,
    };
  }

  if (!params.force) {
    const alreadySent = await hasSmsAlreadyBeenSent({
      supabaseAdmin,
      calendarEventId,
      messageType: params.automation.message_type,
    });

    if (alreadySent) {
      return {
        ok: true,
        skipped: true,
        reason: "SMS tego typu został już wysłany dla tego spotkania.",
        calendarEventId,
        messageType: params.automation.message_type,
      };
    }
  }

  const sender = await getConfiguredSmsSender();
  const senderLabel = sender;
  const eventDateTime = formatSmsAutomationDateTime(event.event_at as string);
  const message = removePolishDiacritics(
    renderSmsAutomationTemplate(params.automation.message_template, {
      ...getBaseSmsAutomationValues(),
      client_name: client.full_name || client.company_name || "",
      event_date: eventDateTime.date,
      event_time: eventDateTime.time,
      advisor_name: getAdvisorName(advisor),
      advisor_phone: getAdvisorPhone(advisor),
    })
  );

  const { data: smsLog, error: smsLogError } = await supabaseAdmin
    .from("sms_messages")
    .insert({
      client_id: client.id,
      meeting_id: calendarEventId,
      sent_by_user_id: params.triggeredByUserId || null,
      recipient_phone: recipientPhone,
      sender: senderLabel,
      message,
      status: "pending",
      provider: "smsapi",
      message_type: params.automation.message_type,
      deduplication_key: params.force
        ? null
        : `${params.automation.message_type}:${calendarEventId}:${event.event_at}`,
    })
    .select("id")
    .single();

  if (smsLogError) {
    throw new Error(`Nie udało się zapisać logu SMS spotkania: ${smsLogError.message}`);
  }

  const smsMessageId = smsLog.id as string;

  try {
    const result = await sendSmsApiMessage({
      to: recipientPhone,
      message,
      sender,
    });

    const { error: updateError } = await supabaseAdmin
      .from("sms_messages")
      .update({
        status: "sent",
        provider_message_id: result.providerMessageId || null,
        provider_response: {
          response: result.raw,
          testMode: result.testMode,
          intendedRecipientPhone: result.intendedRecipientPhone,
          actualRecipientPhone: result.actualRecipientPhone,
        },
        sent_at: new Date().toISOString(),
      })
      .eq("id", smsMessageId);

    if (updateError) {
      console.error("Nie udało się zaktualizować logu SMS spotkania po wysyłce:", updateError);
    }

    const { error: activityError } = await supabaseAdmin
      .from("client_activities")
      .insert({
        client_id: client.id,
        created_by: params.triggeredByUserId || null,
        activity_type: "sms",
        contact_type: "sms",
        status: "sent",
        description: `Automatyczny SMS — ${params.automation.title}\n${message}`,
      });

    if (activityError) {
      console.error("Nie udało się zapisać aktywności SMS spotkania:", activityError);
    }

    return {
      ok: true,
      skipped: false,
      smsMessageId,
      calendarEventId,
      messageType: params.automation.message_type,
      providerMessageId: result.providerMessageId || null,
      providerResponse: result.raw,
      testMode: result.testMode,
      actualRecipientPhone: result.actualRecipientPhone,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Nie udało się wysłać SMS spotkania.";

    const { error: updateError } = await supabaseAdmin
      .from("sms_messages")
      .update({
        status: "failed",
        error_message: errorMessage,
        provider_response: {
          error: errorMessage,
        },
      })
      .eq("id", smsMessageId);

    if (updateError) {
      console.error("Nie udało się zaktualizować logu SMS spotkania po błędzie:", updateError);
    }

    throw error;
  }
}

export async function sendMeetingCreatedConfirmationSms(input: SendMeetingSmsInput) {
  const automations = await getActiveSmsAutomations("meeting_created");
  const results = [];

  for (const automation of automations) {
    results.push(await sendMeetingSms({ ...input, automation }));
  }

  return {
    ok: true,
    skipped: automations.length === 0,
    reason: automations.length === 0 ? "Brak aktywnych automatów po utworzeniu spotkania." : null,
    results,
  };
}

export async function sendMeetingReminderSms(
  input: SendMeetingSmsInput & { automationId?: string }
) {
  const automations = input.automationId
    ? [await getSmsAutomationById(input.automationId, "before_meeting")].filter(
        (automation): automation is SmsAutomation => Boolean(automation)
      )
    : await getActiveSmsAutomations("before_meeting");
  const results = [];

  for (const automation of automations) {
    results.push(await sendMeetingSms({ ...input, automation }));
  }

  return {
    ok: true,
    skipped: automations.length === 0 || results.every((result) => result.skipped),
    reason: automations.length === 0 ? "Brak aktywnego automatu przypomnienia." : null,
    results,
  };
}
