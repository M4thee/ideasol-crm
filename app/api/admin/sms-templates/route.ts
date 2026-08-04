import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  getUnknownSmsTemplatePlaceholders,
  getSmsTemplatePlaceholders,
  SYSTEM_SMS_TEMPLATE_REQUIRED_FIELDS,
  SMS_TEMPLATE_CATEGORIES,
  SMS_TEMPLATE_REQUIRED_FIELDS,
  SMS_TEMPLATE_TONES,
  type SmsTemplateCategory,
  type SmsTemplateRequiredField,
  type SmsTemplateTone,
} from "@/lib/saleSms";
import { removePolishDiacritics } from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SmsTemplateInput = {
  id?: string;
  title?: string;
  messageTemplate?: string;
  tone?: SmsTemplateTone;
  category?: SmsTemplateCategory;
  requiredFields?: SmsTemplateRequiredField[];
  isActive?: boolean;
  sortOrder?: number;
};

const VALID_TONES = new Set<string>(SMS_TEMPLATE_TONES);
const VALID_CATEGORIES = new Set<string>(SMS_TEMPLATE_CATEGORIES);
const VALID_REQUIRED_FIELDS = new Set<string>(
  SMS_TEMPLATE_REQUIRED_FIELDS.map((field) => field.key)
);
const CLIENT_ONLY_FIELDS = new Set(["client_name", "bank_account", "hotline"]);

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Nieznany błąd");
}

function normalizeInput(input: SmsTemplateInput) {
  const title = String(input.title || "").trim();
  const messageTemplate = String(input.messageTemplate || "").trim();
  const tone = String(input.tone || "standard") as SmsTemplateTone;
  const category = String(input.category || "sale") as SmsTemplateCategory;
  const requiredFields = [
    ...new Set(
      (Array.isArray(input.requiredFields) ? input.requiredFields : []).map(String)
    ),
  ] as SmsTemplateRequiredField[];
  const rawSortOrder = Number(input.sortOrder ?? 100);
  const sortOrder = Number.isInteger(rawSortOrder) ? rawSortOrder : 100;

  return {
    title,
    messageTemplate,
    tone,
    category,
    requiredFields,
    isActive: input.isActive !== false,
    sortOrder,
  };
}

function validateInput(input: ReturnType<typeof normalizeInput>) {
  const errors: string[] = [];

  if (!input.title) errors.push("Podaj nazwę szablonu.");
  if (input.title.length > 120) errors.push("Nazwa szablonu może mieć maksymalnie 120 znaków.");
  if (!input.messageTemplate) errors.push("Podaj treść wiadomości.");
  if (input.messageTemplate.length > 1200) {
    errors.push("Treść szablonu może mieć maksymalnie 1200 znaków.");
  }
  if (!VALID_TONES.has(input.tone)) errors.push("Wybierz prawidłowy rodzaj komunikatu.");
  if (!VALID_CATEGORIES.has(input.category)) errors.push("Wybierz prawidłową kategorię SMS.");
  if (input.sortOrder < 0 || input.sortOrder > 10000) {
    errors.push("Kolejność musi mieścić się w zakresie od 0 do 10000.");
  }

  const invalidRequiredFields = input.requiredFields.filter(
    (field) => !VALID_REQUIRED_FIELDS.has(field)
  );
  if (invalidRequiredFields.length > 0) {
    errors.push("Szablon zawiera nieprawidłowe wymagania danych.");
  }

  const unknownPlaceholders = getUnknownSmsTemplatePlaceholders(
    input.messageTemplate
  );
  if (unknownPlaceholders.length > 0) {
    errors.push(
      `Nieznane pola dynamiczne: ${unknownPlaceholders
        .map((field) => `{{${field}}}`)
        .join(", ")}.`
    );
  }

  if (input.category !== "sale") {
    const saleOnlyPlaceholders = getSmsTemplatePlaceholders(
      input.messageTemplate
    ).filter((field) => !CLIENT_ONLY_FIELDS.has(field));
    const saleOnlyRequirements = input.requiredFields.filter(
      (field) => field !== "client_name"
    );

    if (saleOnlyPlaceholders.length > 0 || saleOnlyRequirements.length > 0) {
      errors.push(
        "Szablon marketingowy lub relacyjny nie może korzystać z danych sprzedaży ani wymagać sprzedaży."
      );
    }
  }

  return errors;
}

function createTemplateKey(title: string) {
  const titleSlug = removePolishDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  return `custom_${titleSlug || "sms"}_${suffix}`;
}

async function getTemplates() {
  return supabaseAdmin
    .from("sms_templates")
    .select(
      "id,template_key,title,message_template,tone,category,required_fields,is_active,is_system,sort_order,created_at,updated_at"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  const { data, error } = await getTemplates();

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Nie udało się pobrać szablonów SMS: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, templates: data || [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest(request);

  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const input = normalizeInput((await request.json()) as SmsTemplateInput);
    const errors = validateInput(input);

    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: errors.join(" ") },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("sms_templates")
      .insert({
        template_key: createTemplateKey(input.title),
        title: input.title,
        message_template: input.messageTemplate,
        tone: input.tone,
        category: input.category,
        required_fields: input.requiredFields,
        is_active: input.isActive,
        is_system: false,
        sort_order: input.sortOrder,
        created_by: admin.id,
        updated_by: admin.id,
      })
      .select(
        "id,template_key,title,message_template,tone,category,required_fields,is_active,is_system,sort_order,created_at,updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, template: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Nie udało się dodać szablonu SMS: ${serializeError(error)}` },
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
    const body = (await request.json()) as SmsTemplateInput;
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Brak identyfikatora szablonu." },
        { status: 400 }
      );
    }

    const input = normalizeInput(body);
    const errors = validateInput(input);

    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: errors.join(" ") },
        { status: 400 }
      );
    }

    const { data: existingTemplate, error: existingTemplateError } =
      await supabaseAdmin
        .from("sms_templates")
        .select("template_key,is_system")
        .eq("id", id)
        .maybeSingle();

    if (existingTemplateError) throw existingTemplateError;
    if (!existingTemplate) {
      return NextResponse.json(
        { ok: false, error: "Nie znaleziono szablonu SMS." },
        { status: 404 }
      );
    }

    const lockedRequiredFields = existingTemplate.is_system
      ? SYSTEM_SMS_TEMPLATE_REQUIRED_FIELDS[existingTemplate.template_key] || []
      : [];
    const requiredFields = [
      ...new Set([...input.requiredFields, ...lockedRequiredFields]),
    ];

    const { data, error } = await supabaseAdmin
      .from("sms_templates")
      .update({
        title: input.title,
        message_template: input.messageTemplate,
        tone: input.tone,
        category: input.category,
        required_fields: requiredFields,
        is_active: input.isActive,
        sort_order: input.sortOrder,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id,template_key,title,message_template,tone,category,required_fields,is_active,is_system,sort_order,created_at,updated_at"
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Szablon SMS zniknął podczas zapisu.");

    return NextResponse.json({ ok: true, template: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Nie udało się zapisać szablonu SMS: ${serializeError(error)}` },
      { status: 500 }
    );
  }
}
