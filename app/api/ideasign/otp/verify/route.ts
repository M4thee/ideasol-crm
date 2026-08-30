import { NextResponse } from "next/server";
import { requireIdeaSignMutation, verifyIdeaSignOtp } from "@/lib/ideasign/server";
import { assertSameOrigin } from "@/lib/ideasign/security";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  }

  const context = await requireIdeaSignMutation(request);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Sesja wygasła albo token CSRF jest nieprawidłowy." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    purpose?: unknown;
    code?: unknown;
  } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (body?.purpose !== "entry") {
    return NextResponse.json(
      { ok: false, error: "Końcowy kod OTP musi zostać potwierdzony przez bezpieczną operację zawarcia umowy." },
      { status: 400 }
    );
  }

  const result = await verifyIdeaSignOtp(context, "entry", code, request);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
