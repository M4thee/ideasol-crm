import { NextRequest, NextResponse } from "next/server";
import { exchangeMicrosoftAuthorizationCode } from "@/lib/microsoftGraph";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      return new NextResponse(
        `<html><body style="font-family: Arial, sans-serif; padding: 32px;"><h1>Microsoft OAuth error</h1><p>${error}</p><pre>${errorDescription || ""}</pre></body></html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Brak parametru code z Microsoft OAuth." },
        { status: 400 }
      );
    }

    const tokenData = await exchangeMicrosoftAuthorizationCode(code);

    return new NextResponse(
      `<html><body style="font-family: Arial, sans-serif; padding: 32px; line-height: 1.5;"><h1>Microsoft OAuth połączony</h1><p>Skopiuj poniższy refresh token do <code>.env.local</code> jako:</p><pre style="white-space: pre-wrap; background: #f3f4f6; padding: 16px; border-radius: 8px;">MICROSOFT_DELEGATED_REFRESH_TOKEN=${tokenData.refresh_token || "BRAK_REFRESH_TOKEN"}</pre><p>Po zapisaniu uruchom ponownie dev server.</p></body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nieznany błąd Microsoft OAuth callback.",
      },
      { status: 500 }
    );
  }
}