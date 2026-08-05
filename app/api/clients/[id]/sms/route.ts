import { NextResponse } from "next/server";
import {
  canAccessClientForSms,
  requireSmsRequest,
} from "@/lib/auth/requireSmsRequest";
import {
  buildSaleSmsTemplates,
  type SaleSmsTemplateType,
  type SmsTemplateCategory,
  type SmsTemplateDefinition,
  type SmsTemplateRequiredField,
  type SmsTemplateTone,
} from "@/lib/saleSms";
import {
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  sendSmsApiMessage,
} from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getConfiguredSmsSender } from "@/lib/smsSender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type ClientSmsCategory = Exclude<SmsTemplateCategory, "sale">;
type JsonRecord = Record<string, unknown>;

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

function parseClientCategory(value: unknown): ClientSmsCategory | null {
  const category = String(value || "");
  return category === "marketing" || category === "relationship"
    ? category
    : null;
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

async function authorizeClient(request: Request, clientId: string) {
  const profile = await requireSmsRequest(request);
  if (!profile) return { error: "Brak uprawnienia SMS.", status: 403 as const };

  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("id, assigned_user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) {
    return { error: "Nie znaleziono klienta.", status: 404 as const };
  }

  const canAccess = await canAccessClientForSms({
    userId: profile.id,
    role: profile.role,
    assignedUserId: client.assigned_user_id,
  });

  if (!canAccess) {
    return { error: "Nie masz dostępu do tego klienta.", status: 403 as const };
  }

  return { profile };
}

async function loadClientSmsData(
  clientId: string,
  category: ClientSmsCategory
) {
  const [clientResponse, templatesResponse] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, full_name, company_name, phone, contact_phone")
      .eq("id", clientId)
      .maybeSingle(),
    supabaseAdmin
      .from("sms_templates")
      .select(
        "id,template_key,title,message_template,tone,category,required_fields,is_active,is_system,sort_order"
      )
      .eq("is_active", true)
      .eq("category", category)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (clientResponse.error) {
    throw new Error(`Nie udało się pobrać klienta: ${clientResponse.error.message}`);
  }
  if (!clientResponse.data) throw new Error("Nie znaleziono klienta.");
  if (templatesResponse.error) {
    throw new Error(
      `Nie udało się pobrać szablonów SMS: ${templatesResponse.error.message}`
    );
  }

  const client = clientResponse.data;
  const templateDefinitions = (templatesResponse.data || []).map(
    (template): SmsTemplateDefinition => ({
      id: template.id,
      type: template.template_key,
      title: template.title,
      messageTemplate: template.message_template,
      tone: template.tone as SmsTemplateTone,
      category: template.category as SmsTemplateCategory,
      requiredFields: (template.required_fields || []) as SmsTemplateRequiredField[],
      isActive: template.is_active,
      isSystem: template.is_system,
      sortOrder: template.sort_order,
    })
  );
  const templateTypes = new Set(
    templateDefinitions.map((template) => template.type)
  );
  const messageTypes = [...templateTypes].flatMap((type) => [
    `client_${type}`,
    `sale_${type}`,
  ]);

  const [historyResponse, countResponse] = templateTypes.size > 0
    ? await Promise.all([
        supabaseAdmin
          .from("sms_messages")
          .select("id, message_type, message, status, error_message, created_at, sent_at")
          .eq("client_id", clientId)
          .is("sale_id", null)
          .in(
            "message_type",
            [...templateTypes].map((type) => `client_${type}`)
          )
          .order("created_at", { ascending: false })
          .limit(30),
        supabaseAdmin
          .from("sms_messages")
          .select("message_type, provider_response")
          .eq("client_id", clientId)
          .eq("status", "sent")
          .in("message_type", messageTypes),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (historyResponse.error) {
    throw new Error(`Nie udało się pobrać historii SMS: ${historyResponse.error.message}`);
  }
  if (countResponse.error) {
    throw new Error(`Nie udało się pobrać liczników SMS: ${countResponse.error.message}`);
  }

  const templates = buildSaleSmsTemplates(
    {
      clientName: firstText(client.company_name, client.full_name),
      contractNumber: "",
      contractValue: null,
      depositAmount: null,
      paidTotal: null,
      outstandingAmount: null,
      installationDate: null,
      installationTime: null,
      installerCompanyName: null,
      installerContactName: null,
      installerPhone: null,
    },
    templateDefinitions
  ).map((template) => ({
    ...template,
    message: removePolishDiacritics(template.message),
  }));
  const emptyTemplateSentCounts = Object.fromEntries(
    [...templateTypes].map((type) => [type, 0])
  ) as Record<string, number>;
  const templateSentCounts = (countResponse.data || []).reduce(
    (counts, item) => {
      if (!wasDeliveredToIntendedRecipient(item.provider_response)) return counts;

      const templateType = String(item.message_type || "").replace(
        /^(?:sale|client)_/,
        ""
      );

      if (templateTypes.has(templateType)) counts[templateType] += 1;
      return counts;
    },
    emptyTemplateSentCounts
  );

  return {
    clientName: firstText(client.company_name, client.full_name),
    recipientPhone: firstText(client.phone, client.contact_phone),
    templates,
    templateSentCounts,
    history: historyResponse.data || [],
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: clientId } = await context.params;
    const category = parseClientCategory(new URL(request.url).searchParams.get("category"));

    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Wybierz kategorię marketingową albo relacyjną." },
        { status: 400 }
      );
    }

    const authorization = await authorizeClient(request, clientId);
    if ("error" in authorization) {
      return NextResponse.json(
        { ok: false, error: authorization.error },
        { status: authorization.status }
      );
    }

    const data = await loadClientSmsData(clientId, category);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Błąd pobierania Modułu SMS klienta", error);
    return NextResponse.json(
      { ok: false, error: serializeError(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  let smsMessageId: string | null = null;

  try {
    const { id: clientId } = await context.params;
    const authorization = await authorizeClient(request, clientId);
    if ("error" in authorization) {
      return NextResponse.json(
        { ok: false, error: authorization.error },
        { status: authorization.status }
      );
    }

    const body = (await request.json()) as {
      category?: ClientSmsCategory;
      templateType?: SaleSmsTemplateType;
    };
    const category = parseClientCategory(body.category);
    const templateType = String(body.templateType || "") as SaleSmsTemplateType;

    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Wybierz kategorię marketingową albo relacyjną." },
        { status: 400 }
      );
    }
    if (!/^[a-z0-9_]{3,80}$/.test(templateType)) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy szablon SMS." },
        { status: 400 }
      );
    }

    const data = await loadClientSmsData(clientId, category);
    const template = data.templates.find((item) => item.type === templateType);

    if (!template || template.category !== category || !template.enabled) {
      return NextResponse.json(
        { ok: false, error: template?.reason || "Szablon SMS jest niedostępny." },
        { status: 400 }
      );
    }

    const recipientPhone = normalizePolishPhoneNumber(data.recipientPhone);
    if (!recipientPhone) {
      return NextResponse.json(
        { ok: false, error: "Karta klienta nie ma poprawnego polskiego numeru telefonu." },
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

    const sender = await getConfiguredSmsSender();
    const senderLabel = sender;
    const { data: smsLog, error: smsLogError } = await supabaseAdmin
      .from("sms_messages")
      .insert({
        client_id: clientId,
        sale_id: null,
        sent_by_user_id: authorization.profile.id,
        recipient_phone: recipientPhone,
        sender: senderLabel,
        message,
        status: "pending",
        provider: "smsapi",
        message_type: `client_${templateType}`,
      })
      .select("id")
      .single();

    if (smsLogError) {
      throw new Error(`Nie udało się zapisać historii SMS: ${smsLogError.message}`);
    }
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

      if (result.intendedRecipientPhone === result.actualRecipientPhone) {
        const { error: activityError } = await supabaseAdmin
          .from("client_activities")
          .insert({
            client_id: clientId,
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
    console.error("Błąd wysyłki SMS z karty klienta", error);
    return NextResponse.json(
      { ok: false, error: serializeError(error), smsMessageId },
      { status: 500 }
    );
  }
}
