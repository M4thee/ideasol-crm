import { NextRequest, NextResponse } from "next/server";
import {
  formatSmsAutomationDateTime,
  getBaseSmsAutomationValues,
  getSmsAutomationWindow,
  renderSmsAutomationTemplate,
  type SmsAutomation,
} from "@/lib/automaticSms";
import { getActiveSmsAutomations } from "@/lib/automaticSmsServer";
import {
  canSendAutomaticSmsToRecipient,
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  sendSmsApiMessage,
} from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getConfiguredSmsSender } from "@/lib/smsSender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type JsonRecord = Record<string, unknown>;
type SaleRow = {
  id: string;
  client_id: string | null;
  contract_number: string | null;
  customer_phone: string | null;
  customer_data: JsonRecord | null;
  installation_at: string;
  installation_installer_id: string | null;
};

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Nieznany błąd");
}

async function sendInstallationAutomation(sale: SaleRow, automation: SmsAutomation) {
  let smsMessageId: string | null = null;

  try {
    const customerData = sale.customer_data || {};
    const [clientResponse, installerResponse] = await Promise.all([
      sale.client_id
        ? supabaseAdmin
            .from("clients")
            .select("full_name,company_name,phone,contact_phone")
            .eq("id", sale.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      sale.installation_installer_id
        ? supabaseAdmin
            .from("installers")
            .select("company_name,contact_name,phone")
            .eq("id", sale.installation_installer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (clientResponse.error) throw clientResponse.error;
    if (installerResponse.error) throw installerResponse.error;

    const client = clientResponse.data;
    const installer = installerResponse.data;
    const recipientPhone = normalizePolishPhoneNumber(
      firstText(
        sale.customer_phone,
        customerData.customer_phone,
        customerData.phone,
        client?.phone,
        client?.contact_phone
      )
    );
    const contractNumber = firstText(sale.contract_number, customerData.contract_number);

    if (!recipientPhone) throw new Error("Brak poprawnego numeru telefonu klienta.");
    if (!contractNumber) throw new Error("Brak numeru umowy.");
    if (!installer?.company_name) throw new Error("Brak instalatora przypisanego do montażu.");

    if (!canSendAutomaticSmsToRecipient(recipientPhone)) {
      return { ok: true, skipped: true, reason: "Numer poza trybem testowym." };
    }

    const installationDateTime = formatSmsAutomationDateTime(sale.installation_at);
    const message = removePolishDiacritics(
      renderSmsAutomationTemplate(automation.message_template, {
        ...getBaseSmsAutomationValues(),
        client_name: firstText(client?.full_name, client?.company_name),
        contract_number: contractNumber,
        installation_date: installationDateTime.date,
        installation_time: installationDateTime.time,
        installer_company_name: installer.company_name,
        installer_contact_name: installer.contact_name,
        installer_phone: installer.phone,
      })
    );
    const sender = await getConfiguredSmsSender();
    const { data: smsLog, error: smsLogError } = await supabaseAdmin
      .from("sms_messages")
      .insert({
        client_id: sale.client_id,
        sale_id: sale.id,
        recipient_phone: recipientPhone,
        sender,
        message,
        status: "pending",
        provider: "smsapi",
        message_type: automation.message_type,
        deduplication_key: `${automation.message_type}:${sale.id}:${sale.installation_at}`,
      })
      .select("id")
      .single();

    if (smsLogError?.code === "23505") {
      return { ok: true, skipped: true, reason: "Wiadomość została już obsłużona." };
    }
    if (smsLogError) throw smsLogError;
    smsMessageId = smsLog.id;

    await supabaseAdmin
      .from("sales")
      .update({
        installation_sms_reminder_attempted_at: new Date().toISOString(),
        installation_sms_reminder_error: null,
      })
      .eq("id", sale.id);

    const result = await sendSmsApiMessage({ to: recipientPhone, message, sender });
    const sentAt = new Date().toISOString();

    await Promise.all([
      supabaseAdmin
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
          sent_at: sentAt,
        })
        .eq("id", smsMessageId),
      supabaseAdmin
        .from("sales")
        .update({
          installation_sms_reminder_sent_at: sentAt,
          installation_sms_reminder_error: null,
        })
        .eq("id", sale.id),
    ]);

    if (sale.client_id) {
      const { error: activityError } = await supabaseAdmin.from("client_activities").insert({
        client_id: sale.client_id,
        created_by: null,
        activity_type: "sms",
        contact_type: "sms",
        status: "sent",
        description: `Automatyczny SMS — ${automation.title}\n${message}`,
      });
      if (activityError) console.error("Nie udało się zapisać aktywności SMS", activityError);
    }

    return { ok: true, skipped: false };
  } catch (error) {
    const message = errorMessage(error);
    const updates = [
      supabaseAdmin
        .from("sales")
        .update({
          installation_sms_reminder_attempted_at: new Date().toISOString(),
          installation_sms_reminder_error: message,
        })
        .eq("id", sale.id),
    ];
    if (smsMessageId) {
      updates.push(
        supabaseAdmin
          .from("sms_messages")
          .update({ status: "failed", error_message: message })
          .eq("id", smsMessageId)
      );
    }
    await Promise.all(updates);
    throw error;
  }
}

async function processInstallationReminders(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji." }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || "25") || 25, 100);
  const automations = await getActiveSmsAutomations("before_installation");
  const results: Array<Record<string, unknown>> = [];

  for (const automation of automations) {
    await supabaseAdmin
      .from("sms_messages")
      .update({
        status: "failed",
        error_message: "Poprzednia próba nie została zakończona. Zaplanowano ponowienie.",
      })
      .eq("message_type", automation.message_type)
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 30 * 60_000).toISOString());

    const window = getSmsAutomationWindow(automation.offset_minutes);
    const { data, error } = await supabaseAdmin
      .from("sales")
      .select(
        "id,client_id,contract_number,customer_phone,customer_data,installation_at,installation_installer_id"
      )
      .gte("installation_at", window.from)
      .lte("installation_at", window.to)
      .order("installation_at", { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Nie udało się pobrać montaży: ${error.message}`);

    for (const sale of (data || []) as SaleRow[]) {
      if (dryRun) {
        results.push({ automationId: automation.id, saleId: sale.id, ok: true, dryRun: true, window });
        continue;
      }
      try {
        const result = await sendInstallationAutomation(sale, automation);
        results.push({ automationId: automation.id, saleId: sale.id, ...result });
      } catch (error) {
        console.error("Błąd automatycznego SMS montażowego", {
          automationId: automation.id,
          saleId: sale.id,
          error: errorMessage(error),
        });
        results.push({ automationId: automation.id, saleId: sale.id, ok: false, error: errorMessage(error) });
      }
    }
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    dryRun,
    automations: automations.length,
    due: results.length,
    sent: results.filter((result) => result.ok && !result.skipped && !result.dryRun).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  });
}

export async function GET(request: NextRequest) {
  return processInstallationReminders(request);
}

export async function POST(request: NextRequest) {
  return processInstallationReminders(request);
}
