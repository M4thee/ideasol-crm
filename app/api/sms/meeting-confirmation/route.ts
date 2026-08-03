import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMeetingCreatedConfirmationSms } from "@/lib/meetingSms";

type MeetingConfirmationSmsRequest = {
  calendarEventId?: string;
  force?: boolean;
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Brak konfiguracji Supabase service role dla endpointu SMS spotkania.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Brak tokenu autoryzacji użytkownika." },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Nie udało się potwierdzić użytkownika." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as MeetingConfirmationSmsRequest;
    const calendarEventId = String(body.calendarEventId || "").trim();

    if (!calendarEventId) {
      return NextResponse.json(
        { ok: false, error: "Brak ID spotkania do wysyłki SMS." },
        { status: 400 }
      );
    }

    const result = await sendMeetingCreatedConfirmationSms({
      calendarEventId,
      triggeredByUserId: user.id,
      force: Boolean(body.force),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const details = serializeError(error);
    console.error("Błąd endpointu SMS potwierdzenia spotkania:", details);

    return NextResponse.json(
      {
        ok: false,
        error: "Nie udało się wysłać SMS potwierdzającego spotkanie.",
        details,
      },
      { status: 500 }
    );
  }
}