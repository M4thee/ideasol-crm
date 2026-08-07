import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENT_TYPES = new Set([
  "session_started",
  "session_resumed",
  "session_ended",
  "page_view",
  "calculation_completed",
  "offer_saved",
  "offer_sent",
  "offer_send_failed",
  "offer_queued",
]);

function textValue(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength) || null;
}

function uuidValue(value: unknown) {
  const normalized = textValue(value, 36);
  return normalized && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function getIpAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp || null;

  return candidate && /^[0-9a-f:.]+$/i.test(candidate) ? candidate : null;
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventType = textValue(body.eventType, 60);
  const action = textValue(body.action, 60);
  const auditModule = textValue(body.module, 80);
  const summary = textValue(body.summary, 500);

  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType) || !action || !auditModule || !summary) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe zdarzenie." }, { status: 400 });
  }

  const rawMetadata = body.metadata;
  let metadata: Record<string, unknown> = {};

  if (rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)) {
    const serializedMetadata = JSON.stringify(rawMetadata);
    metadata =
      serializedMetadata.length <= 20_000
        ? JSON.parse(serializedMetadata)
        : {
            truncated: true,
            preview: serializedMetadata.slice(0, 19_500),
          };
  }

  const { error } = await supabaseAdmin.from("crm_audit_logs").insert({
    actor_user_id: user.id,
    event_type: eventType,
    action,
    module: auditModule,
    summary,
    entity_type: textValue(body.entityType, 80),
    entity_id: textValue(body.entityId, 160),
    client_id: uuidValue(body.clientId),
    sale_id: uuidValue(body.saleId),
    offer_id: uuidValue(body.offerId),
    path: textValue(body.path, 500),
    correlation_id: textValue(body.correlationId, 160),
    session_id: textValue(body.sessionId, 160),
    metadata,
    ip_address: getIpAddress(request),
    user_agent: textValue(request.headers.get("user-agent"), 1000),
    request_id: textValue(request.headers.get("x-vercel-id"), 200),
  });

  if (error) {
    console.error("Błąd zapisu logu CRM", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
