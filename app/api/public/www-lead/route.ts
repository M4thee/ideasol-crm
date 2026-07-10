import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { refreshMicrosoftDelegatedAccessToken } from "@/lib/microsoftGraph";
import { sendTeamsDelegatedDirectCalendarNotification } from "@/lib/microsoftTeams";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WWW_LEAD_SECRET = process.env.WWW_LEAD_SECRET || "ideasol-www-lead-v1";
const WWW_LEAD_TEST_TEAMS_EMAIL = process.env.WWW_LEAD_TEST_TEAMS_EMAIL;
const WWW_LEAD_BOARD_CHAT_ID = "19:d33bb206f4cc46a6bf7e788d365be124@thread.v2";
const WWW_LEAD_TEST_BOARD_CHAT_ID = "19:9f0b43a996ef4c71ab493d250909bc61@thread.v2";

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

type PostalCodeLocation = {
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  province?: string | null;
};

type AdvisorLocation = {
  advisorName: string;
  postalCode: string;
};

type AssignedAdvisor = {
  id: string;
  email: string | null;
  displayName: string;
};

const ADVISOR_POSTAL_CODES: AdvisorLocation[] = [
  { advisorName: "Mateusz Rapczewski", postalCode: "91-024" },
  { advisorName: "Mateusz Rapczewski", postalCode: "34-300" },
  { advisorName: "Janusz Uchwat", postalCode: "29-100" },
  { advisorName: "Paweł Czupryński", postalCode: "25-015" },
  { advisorName: "Jan Osmenda", postalCode: "32-089" },
  { advisorName: "Michał Brodziński", postalCode: "32-060" },
  { advisorName: "Aleksandra Jachowicz", postalCode: "42-439" },
];

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizePhone(value: unknown) {
  return cleanText(value).replace(/\s+/g, " ");
}

function cleanDetectedPostalCode(value: unknown) {
  const cleaned = cleanText(value).replace(/\s+/g, "");
  const match = cleaned.match(/(\d{2})-?(\d{3})/);

  if (!match) return "";

  return `${match[1]}-${match[2]}`;
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

function buildLeadNote(payload: WwwLeadPayload) {
  const products = Array.isArray(payload.products)
    ? payload.products.filter(Boolean).join(", ")
    : "";

  return [
    "Lead z formularza WWW — Jestem zainteresowany instalacją.",
    payload.client_type ? `Typ klienta: ${payload.client_type}` : "",
    payload.province ? `Województwo: ${payload.province}` : "",
    payload.postal_code ? `Kod pocztowy: ${payload.postal_code}` : "",
    products ? `Produkty: ${products}` : "",
    payload.message ? `Wiadomość: ${payload.message}` : "",
    payload.page_url ? `Źródło strony: ${payload.page_url}` : "",
    payload.ip ? `IP: ${payload.ip}` : "",
    payload.user_agent ? `User-Agent: ${payload.user_agent}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTeamsText(payload: WwwLeadPayload, clientId?: string, assignedAdvisor?: AssignedAdvisor | null) {
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
    `Przypisany doradca: <strong>${displayValue(assignedAdvisor?.displayName || null)}</strong>`,
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

function buildBoardTeamsText(
  payload: WwwLeadPayload,
  clientId?: string,
  assignedAdvisor?: AssignedAdvisor | null
) {
  const products = Array.isArray(payload.products)
    ? payload.products.filter(Boolean).join(", ")
    : "";

  const assignedAdvisorName = assignedAdvisor?.displayName || "nieprzypisanego użytkownika";

  const lines = [
    `<strong>🌐 Nowy lead z formularza WWW przypisany do użytkownika ${displayValue(assignedAdvisorName)}.</strong>`,
    `Źródło: <strong>ideasol.pl</strong>`,
    `Klient: <strong>${displayValue(cleanText(payload.name))}</strong>`,
    `Telefon: <strong>${displayValue(normalizePhone(payload.phone))}</strong>`,
    `E-mail: <strong>${displayValue(cleanText(payload.email))}</strong>`,
    `Kod pocztowy: <strong>${displayValue(cleanText(payload.postal_code))}</strong>`,
    `Województwo: <strong>${displayValue(cleanText(payload.province))}</strong>`,
    `Produkty: <strong>${displayValue(products)}</strong>`,
  ];

  if (payload.message) {
    lines.push(`Wiadomość: ${displayValue(cleanText(payload.message))}`);
  }

  if (clientId) {
    lines.push(
      "",
      `<a href="https://crm.ideasol.pl/clients/${encodeURIComponent(clientId)}">Otwórz klienta w CRM</a>`
    );
  }

  return lines.join("\n");
}

function calculateDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) {
  const earthRadiusKm = 6371;
  const dLat = ((toLatitude - fromLatitude) * Math.PI) / 180;
  const dLon = ((toLongitude - fromLongitude) * Math.PI) / 180;
  const lat1 = (fromLatitude * Math.PI) / 180;
  const lat2 = (toLatitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findPostalCodeLocation(
  supabase: SupabaseClient,
  postalCode: string,
  options: { allowPrefixFallback?: boolean } = {}
): Promise<PostalCodeLocation | null> {
  const cleanedCode = cleanDetectedPostalCode(postalCode);

  if (!cleanedCode) return null;

  const { data: exactLocations, error: exactError } = await supabase
    .from("postal_code_locations")
    .select("postal_code, latitude, longitude, province")
    .eq("postal_code", cleanedCode)
    .limit(100);

  if (exactError) {
    console.error(`Błąd szukania kodu WWW ${cleanedCode}:`, exactError);
  }

  if (exactLocations && exactLocations.length > 0) {
    const locations = exactLocations as PostalCodeLocation[];

    const latitude =
      locations.reduce((sum, location) => sum + Number(location.latitude || 0), 0) /
      locations.length;

    const longitude =
      locations.reduce((sum, location) => sum + Number(location.longitude || 0), 0) /
      locations.length;

    const province = locations.find((location) => location.province)?.province || null;

    return {
      postal_code: cleanedCode,
      latitude,
      longitude,
      province,
    };
  }

  if (!options.allowPrefixFallback) return null;

  const prefix = cleanedCode.slice(0, 2);
  const targetNumber = Number(cleanedCode.replace("-", ""));

  const { data: fallbackLocations, error: fallbackError } = await supabase
    .from("postal_code_locations")
    .select("postal_code, latitude, longitude, province")
    .like("postal_code", `${prefix}-%`)
    .limit(500);

  if (fallbackError) {
    console.error(`Błąd fallbacku kodu WWW ${cleanedCode}:`, fallbackError);
    return null;
  }

  const nearestLocation = (fallbackLocations || [])
    .filter((location) => cleanDetectedPostalCode(location.postal_code))
    .sort((a, b) => {
      const aNumber = Number(cleanDetectedPostalCode(a.postal_code).replace("-", ""));
      const bNumber = Number(cleanDetectedPostalCode(b.postal_code).replace("-", ""));

      return Math.abs(aNumber - targetNumber) - Math.abs(bNumber - targetNumber);
    })[0];

  return nearestLocation ? (nearestLocation as PostalCodeLocation) : null;
}

async function resolveAdvisorProfile(
  supabase: SupabaseClient,
  advisorName: string
): Promise<AssignedAdvisor | null> {
  const [firstName, ...lastNameParts] = advisorName.split(" ");
  const lastName = lastNameParts.join(" ");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, name, username")
    .ilike("display_name", `%${firstName}%${lastName}%`)
    .maybeSingle();

  if (error) {
    console.error(`WWW lead advisor profile lookup failed for ${advisorName}`, error);
    return null;
  }

  if (!data?.id) return null;

  return {
    id: data.id,
    email: typeof data.email === "string" ? data.email : null,
    displayName:
      (typeof data.display_name === "string" && data.display_name) ||
      (typeof data.name === "string" && data.name) ||
      (typeof data.username === "string" && data.username) ||
      advisorName,
  };
}

async function assignAdvisorByPostalCode(
  supabase: SupabaseClient,
  postalCode: string
): Promise<AssignedAdvisor | null> {
  const leadLocation = await findPostalCodeLocation(supabase, postalCode, {
    allowPrefixFallback: true,
  });

  if (!leadLocation?.latitude || !leadLocation?.longitude) return null;

  const advisorDistances = await Promise.all(
    ADVISOR_POSTAL_CODES.map(async (advisor) => {
      const advisorLocation = await findPostalCodeLocation(supabase, advisor.postalCode, {
        allowPrefixFallback: true,
      });

      if (!advisorLocation?.latitude || !advisorLocation?.longitude) return null;

      return {
        advisorName: advisor.advisorName,
        distanceKm: calculateDistanceKm(
          Number(leadLocation.latitude),
          Number(leadLocation.longitude),
          Number(advisorLocation.latitude),
          Number(advisorLocation.longitude)
        ),
      };
    })
  );

  const nearestAdvisor = advisorDistances
    .filter(Boolean)
    .sort((a, b) => (a?.distanceKm || 0) - (b?.distanceKm || 0))[0];

  if (!nearestAdvisor?.advisorName) return null;

  return resolveAdvisorProfile(supabase, nearestAdvisor.advisorName);
}

async function sendTeamsDelegatedChatMessage({
  chatId,
  message,
  accessToken,
}: {
  chatId: string;
  message: string;
  accessToken: string;
}) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: {
          contentType: "html",
          content: message.replaceAll("\n", "<br />"),
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Teams chat notification failed: ${response.status} ${errorText}`);
  }
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
    const note = buildLeadNote(payload);

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

    const assignedAdvisor = postalCode
      ? await assignAdvisorByPostalCode(supabase, postalCode)
      : null;

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
          province: province || null,
          status: assignedAdvisor ? "Przypisany" : "Nowy lead",
          lead_source: "WWW",
          assigned_user_id: assignedAdvisor?.id || null,
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
        .from("client_tag_links")
        .upsert(
          {
            client_id: clientId,
            tag_id: tagData.id,
            created_by: null,
          },
          { onConflict: "client_id,tag_id" }
        );

      if (relationError) {
        console.error("WWW lead tag assignment failed", relationError);
      }
    }

    if (clientId && !existingClientId && note) {
      const { error: noteError } = await supabase
        .from("client_notes")
        .insert({
          client_id: clientId,
          content: note,
          created_by: null,
        });

      if (noteError) {
        console.error("WWW lead note insert failed", noteError);
      }
    }

    const testTeamsRecipientEmail = await resolveTeamsRecipientEmail(supabase);
    const boardChatId = WWW_LEAD_TEST_TEAMS_EMAIL
      ? WWW_LEAD_TEST_BOARD_CHAT_ID
      : WWW_LEAD_BOARD_CHAT_ID;
    const teamsMessage = buildTeamsText(payload, clientId || undefined, assignedAdvisor);
    const boardTeamsMessage = buildBoardTeamsText(payload, clientId || undefined, assignedAdvisor);
    let teamsSent = false;
    let teamsAdvisorSent = false;
    let teamsBoardSent = false;
    let teamsErrorMessage: string | null = null;

    try {
      const delegatedRefreshToken = process.env.MICROSOFT_DELEGATED_REFRESH_TOKEN;

      if (!delegatedRefreshToken) {
        throw new Error(
          "Brak MICROSOFT_DELEGATED_REFRESH_TOKEN do wysyłki Teams dla leada WWW."
        );
      }

      const delegatedToken = await refreshMicrosoftDelegatedAccessToken(delegatedRefreshToken);
      const delegatedAccessToken = delegatedToken.access_token;

      if (!delegatedAccessToken) {
        throw new Error("Nie udało się pobrać delegowanego tokenu Microsoft Graph dla leada WWW.");
      }

      if (WWW_LEAD_TEST_TEAMS_EMAIL) {
        await sendTeamsDelegatedDirectCalendarNotification({
          userEmail: testTeamsRecipientEmail,
          message: teamsMessage,
          accessToken: delegatedAccessToken,
        });
        teamsAdvisorSent = true;
      } else if (assignedAdvisor?.email) {
        await sendTeamsDelegatedDirectCalendarNotification({
          userEmail: assignedAdvisor.email,
          message: teamsMessage,
          accessToken: delegatedAccessToken,
        });
        teamsAdvisorSent = true;
      } else {
        console.warn("WWW lead assigned advisor email not found; skipping advisor notification.");
      }

      await sendTeamsDelegatedChatMessage({
        chatId: boardChatId,
        message: boardTeamsMessage,
        accessToken: delegatedAccessToken,
      });
      teamsBoardSent = true;
      teamsSent = teamsAdvisorSent || teamsBoardSent;
    } catch (teamsError) {
      console.error("WWW lead Teams delegated notification failed", teamsError);
      teamsErrorMessage = teamsError instanceof Error ? teamsError.message : String(teamsError);
    }

    return NextResponse.json(
      {
        ok: true,
        client_id: clientId,
        duplicate: Boolean(existingClientId),
        assigned_user_id: assignedAdvisor?.id || null,
        assigned_advisor: assignedAdvisor?.displayName || null,
        teams_sent: teamsSent,
        teams_test_recipient_email: WWW_LEAD_TEST_TEAMS_EMAIL ? testTeamsRecipientEmail || null : null,
        teams_advisor_sent: teamsAdvisorSent,
        teams_advisor_email: assignedAdvisor?.email || null,
        teams_board_sent: teamsBoardSent,
        teams_board_chat_id: boardChatId,
        teams_error: teamsErrorMessage,
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