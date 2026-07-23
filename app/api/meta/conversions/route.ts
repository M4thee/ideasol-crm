import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  sendMetaCrmEvent,
  type MetaCrmEventName,
} from "@/lib/metaConversions";

type RequestBody = {
  eventName?: MetaCrmEventName;
  sourceType?: "client_activity" | "calendar_event" | "sale";
  sourceId?: string;
  clientId?: string;
};

const VALID_EVENTS = new Set<MetaCrmEventName>([
  "Schedule",
  "QualifiedLead",
  "Purchase",
]);

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  return error ? null : user;
}

function buildEventId(body: Required<RequestBody>) {
  return `crm:${body.sourceType}:${body.sourceId}:${body.eventName}`;
}

async function verifySource(body: Required<RequestBody>) {
  if (body.sourceType === "client_activity") {
    if (body.eventName !== "Schedule") return null;
    const { data } = await supabaseAdmin
      .from("client_activities")
      .select("id, client_id, contact_type, status, phone_contact_type, phone_status")
      .eq("id", body.sourceId)
      .eq("client_id", body.clientId)
      .maybeSingle();
    const isScheduledMarketingContact =
      (data?.phone_contact_type === "marketing" &&
        data?.phone_status === "meeting_scheduled") ||
      (data?.contact_type === "Kontakt marketingowy" &&
        String(data?.status || "").toLocaleLowerCase("pl-PL") ===
          "umówione spotkanie");
    return isScheduledMarketingContact ? data : null;
  }

  if (body.sourceType === "calendar_event") {
    if (!["Schedule", "QualifiedLead"].includes(body.eventName)) return null;
    const { data } = await supabaseAdmin
      .from("calendar_events")
      .select("id, client_id, event_type, status")
      .eq("id", body.sourceId)
      .eq("client_id", body.clientId)
      .maybeSingle();
    if (body.eventName === "Schedule") {
      return data?.event_type === "meeting" ? data : null;
    }
    return String(data?.status || "").toLocaleLowerCase("pl-PL") ===
      "zakończone - zainteresowany"
      ? data
      : null;
  }

  if (body.sourceType === "sale") {
    if (body.eventName !== "Purchase") return null;
    const { data } = await supabaseAdmin
      .from("sales")
      .select("id, client_id, contract_value, sale_date")
      .eq("id", body.sourceId)
      .eq("client_id", body.clientId)
      .maybeSingle();
    return data;
  }

  return null;
}

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  if (
    !body.eventName ||
    !VALID_EVENTS.has(body.eventName) ||
    !body.sourceType ||
    !["client_activity", "calendar_event", "sale"].includes(body.sourceType) ||
    !body.sourceId ||
    !body.clientId
  ) {
    return NextResponse.json({ error: "Nieprawidłowe dane zdarzenia." }, { status: 400 });
  }

  const completeBody = body as Required<RequestBody>;
  const source = await verifySource(completeBody);
  if (!source) {
    return NextResponse.json({ error: "Nie znaleziono źródła zdarzenia." }, { status: 404 });
  }

  const eventId = buildEventId(completeBody);
  const { data: existing } = await supabaseAdmin
    .from("meta_capi_events")
    .select("id, status, attempts, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  const pendingIsFresh =
    existing?.status === "pending" &&
    Date.now() - new Date(existing.updated_at).getTime() < 5 * 60_000;

  if (existing?.status === "sent" || pendingIsFresh) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (existing) {
    await supabaseAdmin
      .from("meta_capi_events")
      .update({
        status: "pending",
        attempts: (existing.attempts || 0) + 1,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    const { error: claimError } = await supabaseAdmin
      .from("meta_capi_events")
      .insert({
        event_id: eventId,
        event_name: completeBody.eventName,
        source_type: completeBody.sourceType,
        source_id: completeBody.sourceId,
        client_id: completeBody.clientId,
        status: "pending",
        attempts: 1,
      });

    if (claimError) {
      const { data: racedEvent } = await supabaseAdmin
        .from("meta_capi_events")
        .select("status")
        .eq("event_id", eventId)
        .maybeSingle();
      if (racedEvent) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      console.error("[META CAPI] Nie udało się zarejestrować zdarzenia:", claimError);
      return NextResponse.json({ ok: false }, { status: 202 });
    }
  }

  try {
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select(
        "id, full_name, phone, phone_country_code, email, city, postal_code"
      )
      .eq("id", completeBody.clientId)
      .single();

    if (clientError || !client) {
      throw new Error(clientError?.message || "Nie znaleziono klienta.");
    }

    let value: number | undefined;
    let eventTime: Date | undefined;

    if (completeBody.eventName === "Purchase") {
      const sale = source as {
        contract_value?: number | null;
        sale_date?: string | null;
      };
      if (
        typeof sale.contract_value !== "number" ||
        !Number.isFinite(sale.contract_value) ||
        sale.contract_value <= 0
      ) {
        throw new Error("Sprzedaż nie ma bezpiecznej dodatniej wartości contract_value.");
      }
      value = sale.contract_value;
      eventTime = sale.sale_date ? new Date(sale.sale_date) : undefined;
    }

    const result = await sendMetaCrmEvent({
      eventName: completeBody.eventName,
      eventId,
      eventTime,
      user: {
        externalId: client.id,
        fullName: client.full_name,
        phone: client.phone,
        phoneCountryCode: client.phone_country_code,
        email: client.email,
        city: client.city,
        postalCode: client.postal_code,
      },
      value,
      currency: value === undefined ? undefined : "PLN",
    });

    await supabaseAdmin
      .from("meta_capi_events")
      .update({
        status: "sent",
        meta_trace_id: result.fbtrace_id || null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[META CAPI] Wysyłka nie powiodła się:", {
      eventId,
      error: message,
    });

    await supabaseAdmin
      .from("meta_capi_events")
      .update({
        status: "failed",
        last_error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    // CRM jest systemem nadrzędnym: błąd Meta nie może cofnąć zapisu biznesowego.
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
