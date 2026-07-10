import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendTeamsDirectCalendarNotification } from "@/lib/microsoftTeams";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WWW_LEAD_SECRET = process.env.WWW_LEAD_SECRET || "ideasol-www-lead-v1";
const WWW_LEAD_TEST_TEAMS_EMAIL = process.env.WWW_LEAD_TEST_TEAMS_EMAIL;

type WwwLeadPayload = {
  source?: string;
  tag?: string;
  contact_type?: string;
  client_type?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  province?: string;
  postal_code?: string;
  products?: string[];
  page_url?: string;
  user_agent?: string;
  ip?: string;
  created_at?: string;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizePhone(value: unknown) {
  return cleanText(value).replace(/\s+/g, " ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(value?: string | null) {
  const normalizedValue = value?.trim();
  return normalizedValue ? escapeHtml(normalizedValue) : "brak danych";
}

function buildTeamsText(payload: WwwLeadPayload, clientId?: string) {
  const products = Array.isArray(payload.products)
    ? payload.products.filter(Boolean).join(", ")
    : "";

  const lines = [
    "<strong>🌐 Nowy lead z formularza WWW</strong>",
    "",
    "Źródło: <strong>ideasol.pl</strong>",
    `Klient: <strong>${displayValue(cleanText(payload.name))}</strong>`,
    `Telefon: <strong>${displayValue(normalizePhone(payload.phone))}</strong>`,
    `E-mail: <strong>${displayValue(cleanText(payload.email))}</strong>`,
    `Kod pocztowy: <strong>${displayValue(cleanText(payload.postal_code))}</strong>`,
    `Województwo: <strong>${displayValue(cleanText(payload.province))}</strong>`,
    `Produkty: <strong>${displayValue(products)}</strong>`,
  ];

  if (payload.message) {
    lines.push("", `Wiadomość: ${displayValue(cleanText(payload.message))}`);
  }

  if (clientId) {
    lines.push(
      "",
      `<a href="https://crm.ideasol.pl/clients/${encodeURIComponent(clientId)}">Otwórz klienta w CRM</a>`
    );
  }

  return lines.join("\n");
}

async function resolveTeamsRecipientEmail(supabase: SupabaseClient) {
  if (WWW_LEAD_TEST_TEAMS_EMAIL) {
    return WWW_LEAD_TEST_TEAMS_EMAIL;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .ilike("display_name", "%Mateusz%Rapczewski%")
    .maybeSingle();

  if (error) {
    console.error("WWW lead Mateusz profile lookup failed", error);
    return "";
  }

  return typeof data?.email === "string" ? data.email : "";
}

export async function POST(request: NextRequest) {
  try {
    const requestSecret = request.headers.get("x-ideasol-lead-secret");

    if (!WWW_LEAD_SECRET || requestSecret !== WWW_LEAD_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase server configuration" },
        { status: 500 }
      );
    }

    const payload = (await request.json()) as WwwLeadPayload;

    if (payload.contact_type && payload.contact_type !== "lead") {
      return NextResponse.json({ skipped: true, reason: "Not an installation lead" });
    }

    const fullName = cleanText(payload.name);
    const email = cleanText(payload.email).toLowerCase();
    const phone = normalizePhone(payload.phone);
    const postalCode = cleanText(payload.postal_code);
    const province = cleanText(payload.province);

    if (!fullName && !email && !phone) {
      return NextResponse.json(
        { error: "Lead must include at least name, email or phone" },
        { status: 400 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const duplicateFilters = [
      phone ? `phone.eq.${phone}` : "",
      email ? `email.eq.${email}` : "",
    ].filter(Boolean);

    let existingClientId: string | null = null;

    if (duplicateFilters.length > 0) {
      const { data: duplicateClient, error: duplicateError } = await supabase
        .from("clients")
        .select("id")
        .or(duplicateFilters.join(","))
        .maybeSingle();

      if (duplicateError) {
        console.error("WWW lead duplicate check failed", duplicateError);
      }

      existingClientId = duplicateClient?.id || null;
    }

    let clientId = existingClientId;

    if (!clientId) {
      const { data: createdClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          full_name: fullName || "Lead WWW",
          email: email || null,
          phone: phone || null,
          postal_code: postalCode || null,
          city: province || null,
          status: "Nowy lead",
          lead_source: "WWW",
        })
        .select("id")
        .single();

      if (clientError) {
        console.error("WWW lead client insert failed", clientError);
        return NextResponse.json(
          { error: "Client insert failed", details: clientError.message },
          { status: 500 }
        );
      }

      clientId = createdClient.id;
    }

    const { data: tagData, error: tagError } = await supabase
      .from("client_tags")
      .upsert(
        {
          name: "www",
          color: "#2563eb",
          is_active: true,
          is_system: false,
        },
        { onConflict: "name" }
      )
      .select("id")
      .single();

    if (tagError) {
      console.error("WWW lead tag upsert failed", tagError);
    }

    if (clientId && tagData?.id) {
      const { error: relationError } = await supabase
        .from("client_tag_assignments")
        .upsert(
          {
            client_id: clientId,
            tag_id: tagData.id,
          },
          { onConflict: "client_id,tag_id" }
        );

      if (relationError) {
        console.error("WWW lead tag assignment failed", relationError);
      }
    }

    const teamsRecipientEmail = await resolveTeamsRecipientEmail(supabase);

    if (teamsRecipientEmail) {
      try {
        await sendTeamsDirectCalendarNotification({
          userEmail: teamsRecipientEmail,
          message: buildTeamsText(payload, clientId || undefined),
        });
      } catch (teamsError) {
        console.error("WWW lead Teams direct notification failed", teamsError);
      }
    } else {
      console.warn("WWW lead Teams recipient email not found; skipping direct notification.");
    }

    return NextResponse.json(
      {
        ok: true,
        client_id: clientId,
        duplicate: Boolean(existingClientId),
      },
      { status: existingClientId ? 200 : 201 }
    );
  } catch (error) {
    console.error("WWW lead endpoint error", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}