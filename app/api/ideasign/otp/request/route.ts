import { NextResponse } from "next/server";
import { requestIdeaSignOtp, requireIdeaSignMutation } from "@/lib/ideasign/server";
import type { IdeaSignOtpPurpose } from "@/lib/ideasign/types";
import { assertSameOrigin } from "@/lib/ideasign/security";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  }

  const context = await requireIdeaSignMutation(request);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Sesja wygasła albo token CSRF jest nieprawidłowy." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { purpose?: unknown } | null;
  const purpose = body?.purpose as IdeaSignOtpPurpose;
  if (!["entry", "signature"].includes(purpose)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy rodzaj kodu OTP." }, { status: 400 });
  }

  const result = await requestIdeaSignOtp(context, purpose, request);
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
    headers: result.ok || !("retryAfterSeconds" in result)
      ? undefined
      : { "Retry-After": String(result.retryAfterSeconds) },
  });
}

