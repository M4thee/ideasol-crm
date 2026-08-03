import { NextResponse } from "next/server";
import { canAccessSaleForSms, requireSmsRequest } from "@/lib/auth/requireSmsRequest";
import {
  buildSaleSmsTemplates,
  type SaleSmsTemplateType,
} from "@/lib/saleSms";
import { normalizePolishPhoneNumber, sendSmsApiMessage } from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type JsonRecord = Record<string, unknown>;

const TEMPLATE_TYPES = new Set<SaleSmsTemplateType>([
  "deposit_reminder",
  "payment_reminder_1",
  "payment_reminder_2",
  "payment_demand",
  "installation_confirmation",
]);

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Nieznany błąd");
}

async function loadSaleSmsData(saleId: string) {
  const { data: sale, error: saleError } = await supabaseAdmin
    .from("sales")
    .select(
      "id, client_id, seller_id, contract_number, contract_value, deposit_amount, customer_phone, customer_data, offer_snapshot, installation_date, installation_time, installation_installer_id"
    )
    .eq("id", saleId)
    .maybeSingle();

  if (saleError) throw new Error(`Nie udało się pobrać sprzedaży: ${saleError.message}`);
  if (!sale) throw new Error("Nie znaleziono sprzedaży.");

  const customerData = (sale.customer_data || {}) as JsonRecord;
  const offerSnapshot = (sale.offer_snapshot || {}) as JsonRecord;

  const [clientResponse, paymentsResponse, installerResponse, historyResponse] =
    await Promise.all([
      sale.client_id
        ? supabaseAdmin
            .from("clients")
            .select("id, full_name, company_name, phone, contact_phone")
            .eq("id", sale.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("customer_payments")
        .select("id, amount, paid_at, note, created_by, created_at")
        .eq("sale_id", saleId)
        .order("paid_at", { ascending: false })
        .order("created_at", { ascending: false }),
      sale.installation_installer_id
        ? supabaseAdmin
            .from("installers")
            .select("id, company_name, contact_name, phone")
            .eq("id", sale.installation_installer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("sms_messages")
        .select("id, message_type, message, status, error_message, created_at, sent_at")
        .eq("sale_id", saleId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  if (clientResponse.error) {
    throw new Error(`Nie udało się pobrać klienta: ${clientResponse.error.message}`);
  }
  if (paymentsResponse.error) {
    throw new Error(`Nie udało się pobrać wpłat: ${paymentsResponse.error.message}`);
  }
  if (installerResponse.error) {
    throw new Error(`Nie udało się pobrać instalatora: ${installerResponse.error.message}`);
  }
  if (historyResponse.error) {
    throw new Error(`Nie udało się pobrać historii SMS: ${historyResponse.error.message}`);
  }

  const payments = paymentsResponse.data || [];
  const paidTotal = payments.reduce(
    (sum, payment) => sum + (numberValue(payment.amount) || 0),
    0
  );
  const contractValue =
    numberValue(sale.contract_value) ??
    numberValue(customerData.contract_total_gross_after_discount) ??
    numberValue(customerData.contract_total_gross) ??
    numberValue(offerSnapshot.sale_price_gross);
  const outstandingAmount =
    contractValue === null ? null : Math.max(0, contractValue - paidTotal);
  const contractNumber = firstText(
    sale.contract_number,
    customerData.contract_number
  );
  const client = clientResponse.data;
  const recipientPhone = firstText(
    sale.customer_phone,
    customerData.customer_phone,
    customerData.phone,
    client?.phone,
    client?.contact_phone
  );
  const installer = installerResponse.data;
  const templates = buildSaleSmsTemplates({
    contractNumber,
    depositAmount: numberValue(sale.deposit_amount),
    outstandingAmount,
    installationDate: sale.installation_date,
    installationTime: sale.installation_time,
    installerCompanyName: installer?.company_name || null,
  });

  return {
    sale,
    client,
    installer,
    recipientPhone,
    contractNumber,
    contractValue,
    depositAmount: numberValue(sale.deposit_amount),
    paidTotal,
    outstandingAmount,
    payments,
    templates,
    history: historyResponse.data || [],
  };
}

async function authorizeSale(request: Request, saleId: string) {
  const profile = await requireSmsRequest(request);
  if (!profile) return { error: "Brak uprawnienia SMS.", status: 403 as const };

  const { data: sale, error } = await supabaseAdmin
    .from("sales")
    .select("seller_id")
    .eq("id", saleId)
    .maybeSingle();

  if (error || !sale) return { error: "Nie znaleziono sprzedaży.", status: 404 as const };

  const canAccess = await canAccessSaleForSms({
    userId: profile.id,
    role: profile.role,
    sellerId: sale.seller_id,
  });

  if (!canAccess) return { error: "Nie masz dostępu do tej sprzedaży.", status: 403 as const };

  return { profile };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: saleId } = await context.params;
    const authorization = await authorizeSale(request, saleId);

    if ("error" in authorization) {
      return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
    }

    const data = await loadSaleSmsData(saleId);

    return NextResponse.json({
      ok: true,
      data: {
        recipientPhone: data.recipientPhone,
        contractNumber: data.contractNumber,
        contractValue: data.contractValue,
        depositAmount: data.depositAmount,
        paidTotal: data.paidTotal,
        outstandingAmount: data.outstandingAmount,
        installationDate: data.sale.installation_date,
        installationTime: data.sale.installation_time,
        installer: data.installer,
        payments: data.payments,
        templates: data.templates,
        history: data.history,
      },
    });
  } catch (error) {
    console.error("Błąd pobierania modułu SMS sprzedaży", error);
    return NextResponse.json(
      { ok: false, error: serializeError(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  let smsMessageId: string | null = null;

  try {
    const { id: saleId } = await context.params;
    const authorization = await authorizeSale(request, saleId);

    if ("error" in authorization) {
      return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
    }

    const body = (await request.json()) as {
      templateType?: SaleSmsTemplateType;
      message?: string;
    };
    const templateType = String(body.templateType || "") as SaleSmsTemplateType;

    if (!TEMPLATE_TYPES.has(templateType)) {
      return NextResponse.json({ ok: false, error: "Nieprawidłowy szablon SMS." }, { status: 400 });
    }

    const data = await loadSaleSmsData(saleId);
    const template = data.templates.find((item) => item.type === templateType);

    if (!template || !template.enabled) {
      return NextResponse.json(
        { ok: false, error: template?.reason || "Szablon SMS jest niedostępny." },
        { status: 400 }
      );
    }

    const recipientPhone = normalizePolishPhoneNumber(data.recipientPhone);
    if (!recipientPhone) {
      return NextResponse.json(
        { ok: false, error: "Klient nie ma poprawnego polskiego numeru telefonu." },
        { status: 400 }
      );
    }

    const message = String(body.message || template.message).trim();
    if (!message || message.length > 1200) {
      return NextResponse.json(
        { ok: false, error: "Treść SMS musi mieć od 1 do 1200 znaków." },
        { status: 400 }
      );
    }

    const sender = process.env.SMSAPI_SENDER?.trim() || "";
    const senderLabel = sender || "SMSAPI_DEFAULT";
    const messageType = `sale_${templateType}`;
    const { data: smsLog, error: smsLogError } = await supabaseAdmin
      .from("sms_messages")
      .insert({
        client_id: data.sale.client_id,
        sale_id: saleId,
        sent_by_user_id: authorization.profile.id,
        recipient_phone: recipientPhone,
        sender: senderLabel,
        message,
        status: "pending",
        provider: "smsapi",
        message_type: messageType,
      })
      .select("id")
      .single();

    if (smsLogError) throw new Error(`Nie udało się zapisać historii SMS: ${smsLogError.message}`);
    smsMessageId = smsLog.id;

    try {
      const result = await sendSmsApiMessage({ to: recipientPhone, message, sender });

      await supabaseAdmin
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

      if (data.sale.client_id) {
        const { error: activityError } = await supabaseAdmin.from("client_activities").insert({
          client_id: data.sale.client_id,
          created_by: authorization.profile.id,
          activity_type: "sms",
          contact_type: "sms",
          status: "sent",
          description: `${template.title}: ${message}`,
        });

        if (activityError) {
          console.error("Nie udało się zapisać aktywności SMS klienta", activityError);
        }
      }

      return NextResponse.json({
        ok: true,
        smsMessageId,
        testMode: result.testMode,
        actualRecipientPhone: result.actualRecipientPhone,
      });
    } catch (sendError) {
      const errorMessage = serializeError(sendError);
      await supabaseAdmin
        .from("sms_messages")
        .update({ status: "failed", error_message: errorMessage })
        .eq("id", smsMessageId);
      throw sendError;
    }
  } catch (error) {
    console.error("Błąd wysyłki SMS ze sprzedaży", error);
    return NextResponse.json(
      { ok: false, error: serializeError(error), smsMessageId },
      { status: 500 }
    );
  }
}
