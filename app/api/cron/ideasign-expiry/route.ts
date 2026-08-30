import { NextResponse } from "next/server";
import { expireOverdueIdeaSignSessions } from "@/lib/ideasign/lifecycle";
import { appendIdeaSignAuditEvent } from "@/lib/ideasign/server";
import { processPendingIdeaSignDeliveries } from "@/lib/ideasign/finalize-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji." }, { status: 401 });
  }

  const expired = await expireOverdueIdeaSignSessions();
  await Promise.all(
    expired.map((session) =>
      appendIdeaSignAuditEvent({
        signatureSessionId: session.id,
        eventType: "offer_expired",
        request,
        eventData: { source: "scheduled_expiry" },
      })
    )
  );

  const deliveries = await processPendingIdeaSignDeliveries({ request, limit: 20 });

  return NextResponse.json({ ok: true, expiredCount: expired.length, deliveries });
}
