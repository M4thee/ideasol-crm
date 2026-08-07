import { supabase } from "@/lib/supabase";

export type CrmAuditEventInput = {
  eventType: string;
  action: string;
  module: string;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  clientId?: string | null;
  saleId?: string | null;
  offerId?: string | null;
  path?: string | null;
  correlationId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

const AUDIT_SESSION_KEY = "ideasol:crm-audit-session-id";

export function getCrmAuditSessionId() {
  if (typeof window === "undefined") return null;

  let sessionId = window.sessionStorage.getItem(AUDIT_SESSION_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(AUDIT_SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function getAuditContextFromPath(pathname: string) {
  const clientMatch = pathname.match(/^\/clients\/([0-9a-f-]{36})(?:\/|$)/i);
  const saleMatch = pathname.match(/^\/sales\/([0-9a-f-]{36})(?:\/|$)/i);
  const offerMatch = pathname.match(/^\/offers\/([0-9a-f-]{36})(?:\/|$)/i);

  let moduleName = "crm";

  if (pathname === "/") moduleName = "dashboard";
  else if (pathname.startsWith("/clients")) moduleName = "clients";
  else if (pathname.startsWith("/sales")) moduleName = "sales";
  else if (pathname.startsWith("/offers")) moduleName = "offers";
  else if (pathname.startsWith("/calculator")) moduleName = "calculator";
  else if (pathname.startsWith("/calendar")) moduleName = "calendar";
  else if (pathname.startsWith("/tasks")) moduleName = "tasks";
  else if (pathname.startsWith("/reports")) moduleName = "reports";
  else if (pathname.startsWith("/admin")) moduleName = "admin";
  else if (pathname.startsWith("/event")) moduleName = "calendar_events";

  return {
    moduleName,
    clientId: clientMatch?.[1] || null,
    saleId: saleMatch?.[1] || null,
    offerId: offerMatch?.[1] || null,
  };
}

export async function recordCrmAuditEvent(input: CrmAuditEventInput) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return false;

    const response = await fetch("/api/audit/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        sessionId: input.sessionId || getCrmAuditSessionId(),
      }),
      keepalive: true,
    });

    return response.ok;
  } catch (error) {
    console.warn("Nie udało się zapisać zdarzenia audytowego CRM", error);
    return false;
  }
}
