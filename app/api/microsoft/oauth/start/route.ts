

import { NextResponse } from "next/server";

export async function GET() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!tenantId || !clientId || !redirectUri) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Brakuje MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID lub MICROSOFT_REDIRECT_URI.",
      },
      { status: 500 }
    );
  }

  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
  );

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set(
    "scope",
    "offline_access User.Read User.ReadBasic.All Chat.ReadWrite ChatMessage.Send"
  );
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("login_hint", "crm@ideasol.pl");

  return NextResponse.redirect(authUrl.toString());
}