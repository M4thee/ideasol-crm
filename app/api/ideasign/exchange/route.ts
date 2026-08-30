import { NextResponse } from "next/server";
import { exchangeIdeaSignLink } from "@/lib/ideasign/server";
import {
  IDEA_SIGN_ACCESS_COOKIE,
  IDEA_SIGN_ACCESS_TTL_SECONDS,
  IDEA_SIGN_CSRF_COOKIE,
  assertSameOrigin,
} from "@/lib/ideasign/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!/^[A-Za-z0-9_-]{32,180}$/.test(token)) {
    return NextResponse.json({ ok: false, error: "Link jest nieprawidłowy lub wygasł." }, { status: 400 });
  }

  const exchanged = await exchangeIdeaSignLink(token, request);
  if (!exchanged) {
    return NextResponse.json(
      { ok: false, error: "Link został już użyty, wygasł albo proces został zakończony." },
      { status: 410 }
    );
  }

  const response = NextResponse.json({ ok: true, csrfToken: exchanged.csrfToken });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(IDEA_SIGN_ACCESS_COOKIE, exchanged.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: IDEA_SIGN_ACCESS_TTL_SECONDS,
  });
  response.cookies.set(IDEA_SIGN_CSRF_COOKIE, exchanged.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: IDEA_SIGN_ACCESS_TTL_SECONDS,
  });

  return response;
}

