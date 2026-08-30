import { NextResponse } from "next/server";
import { acceptIdeaSignDocuments, requestIdeaSignOtp, requireIdeaSignMutation } from "@/lib/ideasign/server";
import { assertSameOrigin } from "@/lib/ideasign/security";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  }

  const context = await requireIdeaSignMutation(request);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Sesja wygasła albo token CSRF jest nieprawidłowy." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { documentIds?: unknown } | null;
  const documentIds = Array.isArray(body?.documentIds)
    ? body.documentIds.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value))
    : [];

  const accepted = await acceptIdeaSignDocuments(context, documentIds, request);
  if (!accepted.ok) {
    return NextResponse.json(accepted, { status: accepted.status });
  }

  const otp = await requestIdeaSignOtp(context, "signature", request);
  return NextResponse.json(otp, { status: otp.ok ? 200 : otp.status });
}

