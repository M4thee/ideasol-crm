import { NextRequest, NextResponse } from "next/server";
import { buildInstallationReminderMessage } from "@/lib/saleSms";
import {
  canSendAutomaticSmsToRecipient,
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  sendSmsApiMessage,
} from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type JsonRecord = Record<string, unknown>;

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") || "";
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Nieznany błąd");
}

async function processInstallationReminders(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji." }, { status: 401 });
  }

  const now = Date.now();
  const stalePendingBefore = new Date(now - 30 * 60_000).toISOString();
  await supabaseAdmin
    .from("sms_messages")
    .update({
      status: "failed",
      error_message: "Poprzednia próba wysyłki nie została zakończona. Zaplanowano ponowienie.",
    })
    .eq("message_type", "installation_reminder_24h")
    .eq("status", "pending")
    .lt("created_at", stalePendingBefore);

  const windowStart = new Date(now + 23 * 60 * 60_000).toISOString();
  const windowEnd = new Date(now + (24 * 60 + 15) * 60_000).toISOString();
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .select(
      "id, client_id, contract_number, customer_phone, customer_data, installation_at, installation_installer_id"
    )
    .is("installation_sms_reminder_sent_at", null)
    .gte("installation_at", windowStart)
    .lte("installation_at", windowEnd)
    .order("installation_at", { ascending: true })
    .limit(25);

  if (salesError) {
    console.error("Błąd pobierania montaży do przypomnienia SMS", salesError);
    return NextResponse.json({ ok: false, error: salesError.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const sale of sales || []) {
    let smsMessageId: string | null = null;

    try {
      const customerData = (sale.customer_data || {}) as JsonRecord;
      const [clientResponse, installerResponse] = await Promise.all([
        sale.client_id
          ? supabaseAdmin
              .from("clients")
              .select("phone, contact_phone")
              .eq("id", sale.client_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        sale.installation_installer_id
          ? supabaseAdmin
              .from("installers")
              .select("company_name, contact_name, phone")
              .eq("id", sale.installation_installer_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (clientResponse.error) throw clientResponse.error;
      if (installerResponse.error) throw installerResponse.error;

      const recipientPhone = normalizePolishPhoneNumber(
        firstText(
          sale.customer_phone,
          customerData.customer_phone,
          customerData.phone,
          clientResponse.data?.phone,
          clientResponse.data?.contact_phone
        )
      );
      const contractNumber = firstText(sale.contract_number, customerData.contract_number);
      const installer = installerResponse.data;

      if (!recipientPhone) throw new Error("Brak poprawnego numeru telefonu klienta.");
      if (!contractNumber) throw new Error("Brak numeru umowy.");
      if (!installer?.company_name) throw new Error("Brak instalatora przypisanego do montażu.");

      if (!canSendAutomaticSmsToRecipient(recipientPhone)) {
        skipped += 1;
        continue;
      }

      const message = removePolishDiacritics(
        buildInstallationReminderMessage({
          contractNumber,
          installerCompanyName: installer.company_name,
          installerContactName: installer.contact_name,
          installerPhone: installer.phone,
        })
      );
      const sender = process.env.SMSAPI_SENDER?.trim() || "";
      const { data: smsLog, error: smsLogError } = await supabaseAdmin
        .from("sms_messages")
        .insert({
          client_id: sale.client_id,
          sale_id: sale.id,
          recipient_phone: recipientPhone,
          sender: sender || "SMSAPI_DEFAULT",
          message,
          status: "pending",
          provider: "smsapi",
          message_type: "installation_reminder_24h",
          deduplication_key: `installation_reminder_24h:${sale.id}:${sale.installation_at}`,
        })
        .select("id")
        .single();

      if (smsLogError?.code === "23505") {
        skipped += 1;
        continue;
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
        const { error: activityError } = await supabaseAdmin
          .from("client_activities")
          .insert({
            client_id: sale.client_id,
            created_by: null,
            activity_type: "sms",
            contact_type: "sms",
            status: "sent",
            description: `Automatyczne przypomnienie o montażu: ${message}`,
          });

        if (activityError) {
          console.error(
            `Nie udało się zapisać aktywności SMS dla sprzedaży ${sale.id}`,
            activityError
          );
        }
      }

      sent += 1;
    } catch (error) {
      failed += 1;
      const message = errorMessage(error);
      console.error(`Błąd automatycznego SMS montażowego dla sprzedaży ${sale.id}`, error);

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
    }
  }

  return NextResponse.json({ ok: true, due: sales?.length || 0, sent, skipped, failed });
}

export async function GET(request: NextRequest) {
  return processInstallationReminders(request);
}

export async function POST(request: NextRequest) {
  return processInstallationReminders(request);
}
