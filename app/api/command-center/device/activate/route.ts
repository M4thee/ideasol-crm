import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import {
  COMMAND_CENTER_DEVICE_COOKIE,
  COMMAND_CENTER_DEVICE_COOKIE_MAX_AGE,
  digestCommandCenterSecret,
} from "@/lib/command-center/device-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAIRING_CODE_FORMAT = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

function normalizeCode(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function POST(request: Request) {
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Wpisz kod aktywacyjny." }, { status: 400 });
  }

  const code = normalizeCode(body.code);
  if (!PAIRING_CODE_FORMAT.test(code)) {
    return NextResponse.json({ error: "Kod powinien mieć 8 znaków." }, { status: 400 });
  }

  const rawToken = randomBytes(32).toString("base64url");
  const { data: deviceId, error } = await supabaseAdmin.rpc("cc_redeem_device_pairing_code", {
    p_code_digest: digestCommandCenterSecret(code),
    p_access_token_digest: digestCommandCenterSecret(rawToken),
  });
  if (error) {
    console.error("Command Center pairing error:", error);
    return NextResponse.json({ error: "Nie udało się aktywować urządzenia." }, { status: 500 });
  }
  if (!deviceId) {
    return NextResponse.json(
      { error: "Kod jest nieprawidłowy, wygasł albo został już użyty." },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COMMAND_CENTER_DEVICE_COOKIE, rawToken, {
    httpOnly: true,
    maxAge: COMMAND_CENTER_DEVICE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
