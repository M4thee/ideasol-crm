import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refreshMicrosoftDelegatedAccessToken } from "@/lib/microsoftGraph";
import {
  buildTeamsEnergyStorageLeadChannelMessage,
  buildTeamsEnergyStorageLeadDirectMessage,
  sendTeamsDelegatedDirectCalendarNotification,
  sendTeamsDirectEnergyStorageLeadNotification,
  sendTeamsLeadChannelNotification,
} from "@/lib/microsoftTeams";

type RecommendationType = "recommended" | "consider" | "not_recommended";

type LeadPayload = {
  source?: string;
  contact?: {
    firstName?: string;
    lastName?: string | null;
    postalCode?: string;
    phone?: string;
    email?: string | null;
  };
  answers?: {
    hasPv?: "yes" | "no" | null;
    pvPower?: string | null;
    settlementSystem?: "net_billing" | "net_metering" | "unknown";
    billMode?: "monthly" | "yearly";
    billAmount?: string;
    yearlyBill?: number;
    yearlyConsumptionKwh?: number;
    tariff?: string;
    priorities?: string[];
  };
  result?: {
    recommendationType?: RecommendationType;
    recommendationTitle?: string;
    recommendedStorageKwh?: number;
    suggestedPvKw?: number | null;
    yearlySavingsLow?: number;
    yearlySavingsHigh?: number;
    priceLow?: number;
    priceHigh?: number;
    subsidyEstimate?: number;
    paybackYearsLow?: number;
    paybackYearsHigh?: number;
  };
};

type AdvisorInfo = {
  displayName: string | null;
  email: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatMoney(value: unknown) {
  const numberValue = typeof value === "number" ? value : 0;
  return `${Math.round(numberValue).toLocaleString("pl-PL")} zł`;
}

async function getPostalCodeDetails(postalCode: string) {
  const normalizedPostalCode = postalCode.trim();

  if (!/^\d{2}-\d{3}$/.test(normalizedPostalCode)) {
    return null;
  }

  const regionResponse = await supabaseAdmin
    .from("postal_code_regions")
    .select("province")
    .eq("postal_code", normalizedPostalCode)
    .maybeSingle();

  const locationsResponse = await supabaseAdmin
    .from("postal_code_locations")
    .select("city")
    .eq("postal_code", normalizedPostalCode);

  if (regionResponse.error) {
    console.error("energy-storage-lead postal code lookup failed", regionResponse.error);
    return null;
  }

  const cities = Array.from(
    new Set(
      (locationsResponse.data ?? [])
        .map((row) => row.city)
        .filter(Boolean)
    )
  );

  return {
    province: regionResponse.data?.province ?? null,
    cities,
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

async function getAssignedAdvisorId(postalCode: string) {
  const postalCodeLookup = await supabaseAdmin
    .from("postal_code_regions")
    .select("latitude, longitude")
    .eq("postal_code", postalCode)
    .maybeSingle();

  if (postalCodeLookup.error || !postalCodeLookup.data) {
    return null;
  }

  const clientLat = Number(postalCodeLookup.data.latitude);
  const clientLng = Number(postalCodeLookup.data.longitude);

  if (!Number.isFinite(clientLat) || !Number.isFinite(clientLng)) {
    return null;
  }

  const territoriesResponse = await supabaseAdmin
    .from("user_territories")
    .select("user_id, latitude, longitude, radius_km, is_active")
    .eq("is_active", true);

  if (territoriesResponse.error || !territoriesResponse.data) {
    return null;
  }

  let bestMatch: { userId: string; distanceKm: number } | null = null;

  for (const territory of territoriesResponse.data) {
    const lat = Number(territory.latitude);
    const lng = Number(territory.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    const distanceKm = calculateDistanceKm(
      clientLat,
      clientLng,
      lat,
      lng
    );

    if (distanceKm > Number(territory.radius_km ?? 0)) {
      continue;
    }

    if (!bestMatch || distanceKm < bestMatch.distanceKm) {
      bestMatch = {
        userId: territory.user_id,
        distanceKm,
      };
    }
  }

  return bestMatch?.userId ?? null;
}

function buildAnalysisNote(
  payload: LeadPayload,
  options?: {
    advisorName?: string | null;
    province?: string | null;
    cities?: string[];
  }
) {
  const contact = payload.contact ?? {};
  const answers = payload.answers ?? {};
  const result = payload.result ?? {};

  const advisorName = options?.advisorName ?? null;
  const province = options?.province ?? null;
  const cities = options?.cities ?? [];

  const hasPvLabel = answers.hasPv === "yes" ? "TAK" : answers.hasPv === "no" ? "NIE" : "brak danych";
  const settlementLabel =
    answers.settlementSystem === "net_billing"
      ? "Net-billing"
      : answers.settlementSystem === "net_metering"
        ? "Net-metering"
        : "Nie wiem / brak danych";

  return [
    "Źródło: Kalkulator magazynu energii",
    "",
    `Automatycznie przypisano do: ${advisorName ?? "Nie przypisano"}`,
    `Województwo: ${province ?? "brak"}`,
    `Miejscowości z tym kodem: ${cities.length ? cities.join(", ") : "brak"}`,
    "",
    "Dane kontaktowe:",
    `Imię: ${cleanText(contact.firstName) || "brak"}`,
    `Nazwisko: ${cleanText(contact.lastName) || "brak"}`,
    `Telefon: ${cleanText(contact.phone) || "brak"}`,
    `E-mail: ${cleanText(contact.email) || "brak"}`,
    `Kod pocztowy: ${cleanText(contact.postalCode) || "brak"}`,
    "",
    "Odpowiedzi z kalkulatora:",
    `Posiada PV: ${hasPvLabel}`,
    `Moc PV: ${answers.pvPower ? `${answers.pvPower} kWp` : "brak / nie dotyczy"}`,
    `System rozliczeń: ${settlementLabel}`,
    `Rachunek: ${answers.billAmount || "brak"} ${answers.billMode === "yearly" ? "zł rocznie" : "zł miesięcznie"}`,
    `Szacowany roczny koszt energii: ${formatMoney(answers.yearlyBill)}`,
    `Szacowane roczne zużycie: ${Math.round(answers.yearlyConsumptionKwh ?? 0).toLocaleString("pl-PL")} kWh`,
    `Taryfa: ${answers.tariff || "brak"}`,
    `Priorytety: ${answers.priorities?.length ? answers.priorities.join(", ") : "brak"}`,
    "",
    "Wynik kalkulatora:",
    `Rekomendacja: ${result.recommendationTitle || "brak"}`,
    `Typ rekomendacji: ${result.recommendationType || "brak"}`,
    `Sugerowana moc PV: ${result.suggestedPvKw ? `${result.suggestedPvKw} kWp` : "nie dotyczy"}`,
    `Sugerowany magazyn energii: ${result.recommendedStorageKwh ? `${result.recommendedStorageKwh} kWh` : "brak"}`,
    `Szacowana roczna korzyść: ${formatMoney(result.yearlySavingsLow)} - ${formatMoney(result.yearlySavingsHigh)}`,
    `Orientacyjny koszt inwestycji: ${formatMoney(result.priceLow)} - ${formatMoney(result.priceHigh)}`,
    `Możliwa dotacja: do ${formatMoney(result.subsidyEstimate)}`,
    `Szacowany okres zwrotu: ${result.paybackYearsLow ?? "?"}-${result.paybackYearsHigh ?? "?"} lat`,
  ].join("\n");
}


async function insertClient(payload: LeadPayload) {
  const contact = payload.contact ?? {};
  const firstName = cleanText(contact.firstName);
  const lastName = cleanText(contact.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || firstName;
  const phone = cleanText(contact.phone);
  const email = cleanText(contact.email);
  const postalCode = cleanText(contact.postalCode);
  const postalCodeDetails = await getPostalCodeDetails(postalCode);
  const province = postalCodeDetails?.province ?? null;
  const assignedUserId = await getAssignedAdvisorId(postalCode);

  const response = await supabaseAdmin
    .from("clients")
    .insert({
      client_type: "B2C",
      full_name: fullName,
      contact_person: fullName,
      phone,
      contact_phone: phone,
      email: email || null,
      postal_code: postalCode,
      province,
      assigned_user_id: assignedUserId,
      status: "Nowy lead",
      is_lead: true,
      lead_source: "kalkulatorME",
    })
    .select("id")
    .single();

  if (response.error) {
    throw response.error;
  }

  return {
    clientId: response.data.id as string,
    province,
    cities: postalCodeDetails?.cities ?? [],
    assignedUserId,
  };
}

async function getCampaignAuthorId() {
  const configuredAuthorId = process.env.KALKULATOR_ME_AUTHOR_ID?.trim();

  if (configuredAuthorId) {
    return configuredAuthorId;
  }

  const response = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or("display_name.eq.Kampania Kalkulator ME,email.eq.kalkulator.me@ideasol.pl")
    .maybeSingle();

  if (response.error) {
    console.error("energy-storage-lead campaign author lookup failed", response.error);
    return null;
  }

  return response.data?.id ?? null;
}

async function insertAnalysisNote(clientId: string, note: string) {
  const campaignAuthorId = await getCampaignAuthorId();

  const response = await supabaseAdmin
    .from("client_notes")
    .insert({
      client_id: clientId,
      created_by: campaignAuthorId,
      content: note,
    });

  if (response.error) {
    console.error("energy-storage-lead note insert failed", response.error);
  }
}

async function sendTeamsNotifications(params: {
  clientId: string;
  advisor: AdvisorInfo;
  clientName: string;
  clientPhone: string;
  postalCode: string;
}) {
  const crmBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_CRM_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";

  const crmUrl = `${crmBaseUrl.replace(/\/$/, "")}/clients/${params.clientId}`;

  const notificationPayload = {
    advisorName: params.advisor.displayName,
    clientName: params.clientName,
    clientPhone: params.clientPhone,
    postalCode: params.postalCode,
    crmUrl,
  };

  const channelMessage = buildTeamsEnergyStorageLeadChannelMessage(notificationPayload);

  try {
    await sendTeamsLeadChannelNotification({
      userEmail: params.advisor.email ?? "",
      message: channelMessage,
    });
  } catch (error) {
    console.error("energy-storage-lead Teams channel notification failed", error);
  }

  if (!params.advisor.email) {
    return;
  }

  const directMessage = buildTeamsEnergyStorageLeadDirectMessage(notificationPayload);

  try {
    const delegatedRefreshToken = process.env.MICROSOFT_DELEGATED_REFRESH_TOKEN?.trim();

    if (delegatedRefreshToken) {
      const delegatedToken = await refreshMicrosoftDelegatedAccessToken(delegatedRefreshToken);

      if (!delegatedToken.refresh_token) {
        console.warn(
          "Microsoft delegated token refreshed without a new refresh_token. Existing MICROSOFT_DELEGATED_REFRESH_TOKEN remains in use."
        );
      }

      await sendTeamsDelegatedDirectCalendarNotification({
        userEmail: params.advisor.email,
        message: directMessage,
        accessToken: delegatedToken.access_token || "",
      });

      return;
    }

    await sendTeamsDirectEnergyStorageLeadNotification({
      userEmail: params.advisor.email,
      message: directMessage,
    });
  } catch (error) {
    console.error("energy-storage-lead Teams direct notification failed", error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LeadPayload;
    const contact = payload.contact ?? {};
    const firstName = cleanText(contact.firstName);
    const phone = cleanText(contact.phone);
    const postalCode = cleanText(contact.postalCode);

    if (!firstName || phone.replace(/\D/g, "").length < 9 || !/^\d{2}-\d{3}$/.test(postalCode)) {
      return NextResponse.json({ error: "Nieprawidłowe dane kontaktowe." }, { status: 400 });
    }

    const clientResult = await insertClient(payload);

    let advisor: AdvisorInfo = {
      displayName: null,
      email: null,
    };

    if (clientResult.assignedUserId) {
      const advisorResponse = await supabaseAdmin
        .from("profiles")
        .select("display_name, email")
        .eq("id", clientResult.assignedUserId)
        .maybeSingle();

      advisor = {
        displayName: advisorResponse.data?.display_name ?? null,
        email: advisorResponse.data?.email ?? null,
      };
    }

    const note = buildAnalysisNote(payload, {
      advisorName: advisor.displayName,
      province: clientResult.province,
      cities: clientResult.cities,
    });

    await insertAnalysisNote(clientResult.clientId, note);
    await sendTeamsNotifications({
      clientId: clientResult.clientId,
      advisor,
      clientName: [cleanText(contact.firstName), cleanText(contact.lastName)].filter(Boolean).join(" ") || cleanText(contact.firstName),
      clientPhone: phone,
      postalCode,
    });

    return NextResponse.json({ ok: true, clientId: clientResult.clientId });
  } catch (error) {
    console.error("energy-storage-lead error", error);
    return NextResponse.json({ error: "Nie udało się zapisać zgłoszenia." }, { status: 500 });
  }
}