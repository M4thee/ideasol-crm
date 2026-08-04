import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  getInvalidSmsAutomationPlaceholders,
  SMS_AUTOMATION_TRIGGERS,
  type SmsAutomationTrigger,
} from "@/lib/automaticSms";
import { removePolishDiacritics } from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutomationInput = {
  id?: string;
  title?: string;
  triggerType?: SmsAutomationTrigger;
  messageTemplate?: string;
  offsetMinutes?: number;
  isActive?: boolean;
  sortOrder?: number;
};

const VALID_TRIGGERS = new Set<string>(SMS_AUTOMATION_TRIGGERS);
const SELECT_FIELDS =
  "id,automation_key,message_type,title,trigger_type,message_template,offset_minutes,is_active,is_system,sort_order,created_at,updated_at";

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Nieznany błąd");
}

function normalizeInput(input: AutomationInput) {
  const triggerType = String(input.triggerType || "before_meeting") as SmsAutomationTrigger;
  const rawOffset = Number(input.offsetMinutes ?? 1440);
  const rawSortOrder = Number(input.sortOrder ?? 100);

  return {
    title: String(input.title || "").trim(),
    triggerType,
    messageTemplate: String(input.messageTemplate || "").trim(),
    offsetMinutes: triggerType === "meeting_created" ? 0 : rawOffset,
    isActive: input.isActive !== false,
    sortOrder: Number.isInteger(rawSortOrder) ? rawSortOrder : 100,
  };
}

function validateInput(input: ReturnType<typeof normalizeInput>) {
  const errors: string[] = [];

  if (!input.title) errors.push("Podaj nazwę automatycznej wiadomości.");
  if (input.title.length > 120) errors.push("Nazwa może mieć maksymalnie 120 znaków.");
  if (!VALID_TRIGGERS.has(input.triggerType)) errors.push("Wybierz prawidłowe zdarzenie.");
  if (!input.messageTemplate) errors.push("Podaj treść wiadomości.");
  if (input.messageTemplate.length > 1200) {
    errors.push("Treść może mieć maksymalnie 1200 znaków.");
  }
  if (!Number.isInteger(input.offsetMinutes) || input.offsetMinutes < 0 || input.offsetMinutes > 43200) {
    errors.push("Czas wysyłki musi mieścić się w zakresie od 0 minut do 30 dni.");
  }
  if (input.triggerType !== "meeting_created" && input.offsetMinutes < 1) {
    errors.push("Wiadomość przed terminem musi być wysłana co najmniej minutę wcześniej.");
  }
  if (input.sortOrder < 0 || input.sortOrder > 10000) {
    errors.push("Kolejność musi mieścić się w zakresie od 0 do 10000.");
  }

  if (VALID_TRIGGERS.has(input.triggerType)) {
    const invalidPlaceholders = getInvalidSmsAutomationPlaceholders(
      input.messageTemplate,
      input.triggerType
    );
    if (invalidPlaceholders.length > 0) {
      errors.push(
        `Pola niedostępne dla tego zdarzenia: ${invalidPlaceholders
          .map((field) => `{{${field}}}`)
          .join(", ")}.`
      );
    }
  }

  return errors;
}

function createIdentifiers(title: string) {
  const slug = removePolishDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

  return {
    automationKey: `custom_${slug || "automatic_sms"}_${suffix}`,
    messageType: `automatic_${suffix}`,
  };
}

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("sms_automations")
    .select(SELECT_FIELDS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Nie udało się pobrać automatów SMS: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, automations: data || [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const input = normalizeInput((await request.json()) as AutomationInput);
    const errors = validateInput(input);
    if (errors.length > 0) {
      return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });
    }

    const identifiers = createIdentifiers(input.title);
    const { data, error } = await supabaseAdmin
      .from("sms_automations")
      .insert({
        automation_key: identifiers.automationKey,
        message_type: identifiers.messageType,
        title: input.title,
        trigger_type: input.triggerType,
        message_template: input.messageTemplate,
        offset_minutes: input.offsetMinutes,
        is_active: input.isActive,
        is_system: false,
        sort_order: input.sortOrder,
        created_by: admin.id,
        updated_by: admin.id,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, automation: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Nie udało się dodać automatu SMS: ${serializeError(error)}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as AutomationInput;
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Brak identyfikatora automatu." }, { status: 400 });
    }

    const input = normalizeInput(body);
    const errors = validateInput(input);
    if (errors.length > 0) {
      return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("sms_automations")
      .update({
        title: input.title,
        trigger_type: input.triggerType,
        message_template: input.messageTemplate,
        offset_minutes: input.offsetMinutes,
        is_active: input.isActive,
        sort_order: input.sortOrder,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(SELECT_FIELDS)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono automatu SMS." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, automation: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Nie udało się zapisać automatu SMS: ${serializeError(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "Brak identyfikatora automatu." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sms_automations")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Nie udało się usunąć automatu SMS: ${error.message}` },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono automatu SMS." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
