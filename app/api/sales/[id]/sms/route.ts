import { NextResponse } from "next/server";
import { canAccessSaleForSms, requireSmsRequest } from "@/lib/auth/requireSmsRequest";
import {
  buildSaleSmsTemplates,
  type SmsTemplateDefinition,
  type SmsTemplateRequiredField,
  type SmsTemplateTone,
  type SaleSmsTemplateType,
} from "@/lib/saleSms";
import {
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  sendSmsApiMessage,
} from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type JsonRecord = Record<string, unknown>;
type SmsRecipientSource = "sale" | "client";

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

function wasDeliveredToIntendedRecipient(providerResponse: unknown) {
  if (typeof providerResponse !== "object" || providerResponse === null) return true;

  const response = providerResponse as JsonRecord;
  const intendedRecipientPhone = firstText(response.intendedRecipientPhone);
  const actualRecipientPhone = firstText(response.actualRecipientPhone);

  return (
    !intendedRecipientPhone ||
    !actualRecipientPhone ||
    intendedRecipientPhone === actualRecipientPhone
  );
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

  const [
    clientResponse,
    paymentsResponse,
    installerResponse,
    historyResponse,
    templatesResponse,
  ] =
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
      supabaseAdmin
        .from("sms_templates")
        .select(
          "id,template_key,title,message_template,tone,required_fields,is_active,is_system,sort_order"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
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
  if (templatesResponse.error) {
    throw new Error(
      `Nie udało się pobrać szablonów SMS: ${templatesResponse.error.message}`
    );
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
  const saleRecipientPhone = firstText(
    sale.customer_phone,
    customerData.customer_phone,
    customerData.phone
  );
  const clientRecipientPhone = firstText(
    client?.phone,
    client?.contact_phone
  );
  const installer = installerResponse.data;
  const templateDefinitions = (templatesResponse.data || []).map(
    (template): SmsTemplateDefinition => ({
      id: template.id,
      type: template.template_key,
      title: template.title,
      messageTemplate: template.message_template,
      tone: template.tone as SmsTemplateTone,
      requiredFields: (template.required_fields || []) as SmsTemplateRequiredField[],
      isActive: template.is_active,
      isSystem: template.is_system,
      sortOrder: template.sort_order,
    })
  );
  const templateTypes = new Set(
    templateDefinitions.map((template) => template.type)
  );
  const clientTemplateHistoryResponse = sale.client_id && templateTypes.size > 0
    ? await supabaseAdmin
        .from("sms_messages")
        .select("message_type, provider_response")
        .eq("client_id", sale.client_id)
        .eq("status", "sent")
        .in(
          "message_type",
          [...templateTypes].map((type) => `sale_${type}`)
        )
    : { data: [], error: null };

  if (clientTemplateHistoryResponse.error) {
    throw new Error(
      `Nie udało się pobrać liczników SMS klienta: ${clientTemplateHistoryResponse.error.message}`
    );
  }

  const templates = buildSaleSmsTemplates(
    {
      clientName: firstText(client?.company_name, client?.full_name),
      contractNumber,
      contractValue,
      depositAmount: numberValue(sale.deposit_amount),
      paidTotal,
      outstandingAmount,
      installationDate: sale.installation_date,
      installationTime: sale.installation_time,
      installerCompanyName: installer?.company_name || null,
      installerContactName: installer?.contact_name || null,
      installerPhone: installer?.phone || null,
    },
    templateDefinitions
  ).map((template) => ({
    ...template,
    message: removePolishDiacritics(template.message),
  }));
  const emptyTemplateSentCounts = Object.fromEntries(
    [...templateTypes].map((type) => [type, 0])
  ) as Record<string, number>;
  const templateSentCounts = (clientTemplateHistoryResponse.data || []).reduce(
    (counts, item) => {
      if (!wasDeliveredToIntendedRecipient(item.provider_response)) return counts;

      const templateType = String(item.message_type || "").replace(
        /^sale_/,
        ""
      ) as SaleSmsTemplateType;

      if (templateTypes.has(templateType)) {
        counts[templateType] += 1;
      }

      return counts;
    },
    emptyTemplateSentCounts
  );

  return {
    sale,
    client,
    installer,
    recipientPhones: {
      sale: saleRecipientPhone,
      client: clientRecipientPhone,
    },
    contractNumber,
    contractValue,
    depositAmount: numberValue(sale.deposit_amount),
    paidTotal,
    outstandingAmount,
    payments,
    templates,
    templateSentCounts,
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
        recipientPhones: data.recipientPhones,
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
        templateSentCounts: data.templateSentCounts,
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
      recipientSource?: SmsRecipientSource;
    };
    const templateType = String(body.templateType || "") as SaleSmsTemplateType;
    const recipientSource = String(body.recipientSource || "") as SmsRecipientSource;

    if (!/^[a-z0-9_]{3,80}$/.test(templateType)) {
      return NextResponse.json({ ok: false, error: "Nieprawidłowy szablon SMS." }, { status: 400 });
    }

    if (!(["sale", "client"] as SmsRecipientSource[]).includes(recipientSource)) {
      return NextResponse.json(
        { ok: false, error: "Wybierz numer ze sprzedaży albo z karty klienta." },
        { status: 400 }
      );
    }

    const data = await loadSaleSmsData(saleId);
    const template = data.templates.find((item) => item.type === templateType);

    if (!template || !template.enabled) {
      return NextResponse.json(
        { ok: false, error: template?.reason || "Szablon SMS jest niedostępny." },
        { status: 400 }
      );
    }

    const recipientPhone = normalizePolishPhoneNumber(
      data.recipientPhones[recipientSource]
    );
    if (!recipientPhone) {
      return NextResponse.json(
        {
          ok: false,
          error:
            recipientSource === "sale"
              ? "Sprzedaż nie ma poprawnego polskiego numeru telefonu."
              : "Karta klienta nie ma poprawnego polskiego numeru telefonu.",
        },
        { status: 400 }
      );
    }

    const message = removePolishDiacritics(template.message).trim();
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

      if (
        data.sale.client_id &&
        result.intendedRecipientPhone === result.actualRecipientPhone
      ) {
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
