import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTeamsDirectNoteMentionNotification } from "@/lib/microsoftTeams";

type NoteMentionTeamsRequest = {
  userId?: string;
  userEmail?: string;
  mentionedByName?: string;
  clientName?: string;
  noteUrl?: string;
  message?: string;
  url?: string;
};

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

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Brak konfiguracji Supabase service role dla Teams notification endpoint.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NoteMentionTeamsRequest;
    const userId = String(body.userId || "").trim();
    let userEmail = String(body.userEmail || "").trim().toLowerCase();
    const legacyMessage = String(body.message || "").trim();
    const mentionedByName = String(body.mentionedByName || "Użytkownik CRM").trim();
    const clientName = String(body.clientName || "kliencie").trim();
    const noteUrl = String(body.noteUrl || body.url || "").trim();

    if (!userEmail && !userId) {
      return NextResponse.json(
        { ok: false, error: "Brak użytkownika odbiorcy powiadomienia Teams." },
        { status: 400 }
      );
    }

    if (!noteUrl) {
      return NextResponse.json(
        { ok: false, error: "Brak linku do notatki CRM dla powiadomienia Teams." },
        { status: 400 }
      );
    }

    if (!userEmail && userId) {
      const supabaseAdmin = getSupabaseAdminClient();
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Błąd pobierania adresu e-mail użytkownika do Teams:", profileError);
      }

      userEmail = String(profileData?.email || "").trim().toLowerCase();
    }

    if (!userEmail) {
      return NextResponse.json(
        { ok: false, error: "Nie znaleziono adresu e-mail odbiorcy Teams." },
        { status: 404 }
      );
    }

    console.log("Wysyłka indywidualnej wiadomości Teams o wzmiance:", {
      userEmail,
      userId,
      mentionedByName,
      clientName,
      noteUrl,
      legacyMessage: legacyMessage || null,
    });

    try {
      const result = await sendTeamsDirectNoteMentionNotification({
        userEmail,
        mentionedByName,
        clientName,
        noteUrl,
      });

      return NextResponse.json({ ok: true, result });
    } catch (teamsError) {
      const details = serializeError(teamsError);
      console.error("Błąd direct Teams dla wzmianki:", details);

      return NextResponse.json(
        {
          ok: false,
          error: "Nie udało się wysłać indywidualnej wiadomości Teams.",
          details,
          debug: {
            userEmail,
            userId,
            mentionedByName,
            clientName,
            noteUrl,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const details = serializeError(error);
    console.error("Błąd wysyłki powiadomienia Teams o wzmiance:", details);

    return NextResponse.json(
      { ok: false, error: "Nie udało się wysłać powiadomienia Teams.", details },
      { status: 500 }
    );
  }
}