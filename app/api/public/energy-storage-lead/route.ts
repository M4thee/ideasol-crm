import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refreshMicrosoftDelegatedAccessToken } from "@/lib/microsoftGraph";
import {
  buildTeamsEnergyStorageLeadChannelMessage,
  buildTeamsEnergyStorageLeadDirectMessage,
  sendTeamsDelegatedDirectCalendarNotification,
  sendTeamsDelegatedLeadChannelNotification,
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
    turnstileToken?: string | null;
    honeypot?: string | null;
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

type LeadAnswers = NonNullable<LeadPayload["answers"]>;

type AdvisorInfo = {
  displayName: string | null;
  email: string | null;
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://crm.ideasol.pl",
  "https://www.ideasol.pl",
  "https://ideasol.pl",
];

function getAllowedOrigins() {
  const configuredOrigins = process.env.PUBLIC_LEAD_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]));
}

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

async function findRecentDuplicateLead(phone: string, email: string | null) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from("clients")
    .select("id, phone, email, created_at")
    .gte("created_at", since)
    .limit(1);

  if (email) {
    query = query.or(`phone.ilike.%${normalizedPhone}%,email.ilike.${email}`);
  } else {
    query = query.ilike("phone", `%${normalizedPhone}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("energy-storage-lead duplicate check failed", error);
    return null;
  }

  return data?.[0] ?? null;
}

async function verifyTurnstileToken(token: string, request: Request) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secretKey) {
    console.warn("energy-storage-lead Turnstile skipped - secret key not configured");
    return true;
  }

  if (!token) {
    return false;
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (ip) {
    formData.append("remoteip", ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    console.error("energy-storage-lead Turnstile verification HTTP error", response.status);
    return false;
  }

  const result = (await response.json()) as { success?: boolean; [key: string]: unknown };

  if (!result.success) {
    console.warn("energy-storage-lead Turnstile verification failed", result);
  }

  return Boolean(result.success);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatMoney(value: unknown) {
  const numberValue = typeof value === "number" ? value : 0;
  return `${Math.round(numberValue).toLocaleString("pl-PL")} zł`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSettlementSystem(value: LeadAnswers["settlementSystem"]) {
  if (value === "net_billing") return "Net-billing";
  if (value === "net_metering") return "Net-metering";
  return "Nie wiem / brak danych";
}

function formatHasPv(value: LeadAnswers["hasPv"]) {
  if (value === "yes") return "TAK";
  if (value === "no") return "NIE";
  return "Brak danych";
}

function formatPaybackYears(low: unknown, high: unknown) {
  const lowValue = typeof low === "number" ? low : null;
  const highValue = typeof high === "number" ? high : null;

  if (lowValue === null && highValue === null) return "Brak danych";
  if (lowValue !== null && highValue !== null && lowValue === highValue) return `około ${lowValue} lat`;
  if (lowValue !== null && highValue !== null) return `${lowValue}-${highValue} lat`;
  return `${lowValue ?? highValue} lat`;
}

function buildHumanRecommendation(payload: LeadPayload) {
  const result = payload.result ?? {};
  const answers = payload.answers ?? {};
  const storageLabel = result.recommendedStorageKwh ? `${result.recommendedStorageKwh} kWh` : "magazyn energii";
  const pvLabel = result.suggestedPvKw ? `${result.suggestedPvKw} kWp` : null;

  const mainRecommendation = answers.hasPv === "no" && pvLabel
    ? `Instalacja PV ${pvLabel} + magazyn energii ${storageLabel}`
    : `Magazyn energii ${storageLabel}`;

  if (result.recommendationType === "not_recommended") {
    return {
      title: mainRecommendation,
      description:
        "W obecnej sytuacji magazyn energii może nie przynieść znaczących oszczędności wyłącznie finansowych, ale nadal może być interesującym rozwiązaniem, jeżeli zależy Panu/Pani na większej autokonsumpcji, zasilaniu awaryjnym lub lepszym wykorzystaniu instalacji fotowoltaicznej.",
    };
  }

  if (result.recommendationType === "consider") {
    return {
      title: mainRecommendation,
      description:
        "Wynik wskazuje, że magazyn energii może mieć sens, szczególnie gdy oprócz oszczędności ważne są dla Pana/Pani bezpieczeństwo energetyczne, backup lub lepsze wykorzystanie energii z fotowoltaiki.",
    };
  }

  return {
    title: mainRecommendation,
    description:
      "Na podstawie podanych danych magazyn energii wygląda na rozwiązanie warte dalszej analizy. Dokładny dobór powinien uwzględniać profil zużycia energii, parametry instalacji oraz możliwości uzyskania dotacji.",
  };
}

function buildEmailMetricCard(label: string, value: string, accentColor: string) {
  return `
    <td style="width:33.33%;padding:8px;vertical-align:top;">
      <div style="border:1px solid #E5E7EB;border-radius:18px;padding:16px;background:#FFFFFF;min-height:92px;">
        <div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(label)}</div>
        <div style="margin-top:10px;font-size:20px;font-weight:800;color:${accentColor};line-height:1.2;">${escapeHtml(value)}</div>
      </div>
    </td>`;
}

function buildEmailTableRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:11px 12px;border-bottom:1px solid #E5E7EB;color:#64748B;font-size:14px;">${escapeHtml(label)}</td>
      <td style="padding:11px 12px;border-bottom:1px solid #E5E7EB;color:#0F172A;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
    </tr>`;
}

function normalizeProvinceName(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const map: Record<string, string> = {
    "dolnoslaskie": "Dolnośląskie",
    "dolno slaskie": "Dolnośląskie",
    "lower silesia": "Dolnośląskie",
    "lower silesian": "Dolnośląskie",

    "kujawsko pomorskie": "Kujawsko-pomorskie",
    "kuyavian pomeranian": "Kujawsko-pomorskie",
    "cuyavian pomeranian": "Kujawsko-pomorskie",

    "lubelskie": "Lubelskie",
    "lublin": "Lubelskie",
    "lublin province": "Lubelskie",

    "lubuskie": "Lubuskie",
    "lubusz": "Lubuskie",
    "lubusz province": "Lubuskie",

    "lodzkie": "Łódzkie",
    "lodz": "Łódzkie",
    "lodz province": "Łódzkie",
    "lodz voivodeship": "Łódzkie",

    "malopolskie": "Małopolskie",
    "malo polskie": "Małopolskie",
    "lesser poland": "Małopolskie",
    "lesser poland province": "Małopolskie",

    "mazowieckie": "Mazowieckie",
    "masovian": "Mazowieckie",
    "masovia": "Mazowieckie",
    "mazovia": "Mazowieckie",

    "opolskie": "Opolskie",
    "opole": "Opolskie",
    "opole province": "Opolskie",

    "podkarpackie": "Podkarpackie",
    "subcarpathian": "Podkarpackie",
    "subcarpathia": "Podkarpackie",

    "podlaskie": "Podlaskie",
    "podlasie": "Podlaskie",

    "pomorskie": "Pomorskie",
    "pomeranian": "Pomorskie",
    "pomerania": "Pomorskie",

    "slaskie": "Śląskie",
    "silesia": "Śląskie",
    "silesian": "Śląskie",
    "upper silesia": "Śląskie",

    "swietokrzyskie": "Świętokrzyskie",
    "holy cross": "Świętokrzyskie",
    "holy cross province": "Świętokrzyskie",

    "warminsko mazurskie": "Warmińsko-mazurskie",
    "warmian masurian": "Warmińsko-mazurskie",
    "warmia masuria": "Warmińsko-mazurskie",

    "wielkopolskie": "Wielkopolskie",
    "greater poland": "Wielkopolskie",
    "greater poland province": "Wielkopolskie",

    "zachodniopomorskie": "Zachodniopomorskie",
    "zachodnio pomorskie": "Zachodniopomorskie",
    "west pomeranian": "Zachodniopomorskie",
    "western pomerania": "Zachodniopomorskie",
  };

  return map[normalized] ?? value.trim();
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
    province: normalizeProvinceName(regionResponse.data?.province ?? null),
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


async function sendLeadResultEmail(payload: LeadPayload) {
  const email = cleanText(payload.contact?.email);

  if (!email) {
    return;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn("energy-storage-lead email skipped - SMTP not configured");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort === 587,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const contact = payload.contact ?? {};
  const answers = payload.answers ?? {};
  const result = payload.result ?? {};
  const recommendation = buildHumanRecommendation(payload);
  const firstName = cleanText(contact.firstName);
  const greeting = firstName ? `Dzień dobry, ${escapeHtml(firstName)}.` : "Dzień dobry.";
  const landingName = process.env.KALKULATOR_ME_LANDING_NAME || "IdeaSol";
  const landingUrl = process.env.KALKULATOR_ME_LANDING_URL || "https://www.ideasol.pl";
  const logoUrl = process.env.KALKULATOR_ME_LOGO_URL || "https://www.ideasol.pl/logo.png";
  const priorities = answers.priorities?.length ? answers.priorities.join(", ") : "Brak danych";
  const yearlyBillLabel = typeof answers.yearlyBill === "number" ? formatMoney(answers.yearlyBill) : "Brak danych";
  const yearlyConsumptionLabel = typeof answers.yearlyConsumptionKwh === "number"
    ? `${Math.round(answers.yearlyConsumptionKwh).toLocaleString("pl-PL")} kWh`
    : "Brak danych";

  const metricsHtml = [
    buildEmailMetricCard(
      "Szacowana korzyść",
      `${formatMoney(result.yearlySavingsLow)} - ${formatMoney(result.yearlySavingsHigh)} / rok`,
      "#059669"
    ),
    buildEmailMetricCard(
      "Koszt inwestycji",
      `${formatMoney(result.priceLow)} - ${formatMoney(result.priceHigh)}`,
      "#EA580C"
    ),
    buildEmailMetricCard(
      "Możliwa dotacja",
      `do ${formatMoney(result.subsidyEstimate)}`,
      "#0284C7"
    ),
  ].join("");

  const answersRowsHtml = [
    buildEmailTableRow("Posiada PV", formatHasPv(answers.hasPv)),
    buildEmailTableRow("Moc PV", answers.pvPower ? `${answers.pvPower} kWp` : "Brak / nie dotyczy"),
    buildEmailTableRow("System rozliczeń", formatSettlementSystem(answers.settlementSystem)),
    buildEmailTableRow("Taryfa", answers.tariff || "Brak danych"),
    buildEmailTableRow("Rachunek", `${answers.billAmount || "Brak"} ${answers.billMode === "yearly" ? "zł rocznie" : "zł miesięcznie"}`),
    buildEmailTableRow("Szacowany roczny koszt energii", yearlyBillLabel),
    buildEmailTableRow("Szacowane roczne zużycie", yearlyConsumptionLabel),
    buildEmailTableRow("Priorytety", priorities),
  ].join("");

  const html = `
<!doctype html>
<html lang="pl">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wynik analizy magazynu energii</title>
  </head>
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Twój wynik z kalkulatora magazynów energii jest gotowy.
    </div>

    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:#F1F5F9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:720px;background:#FFFFFF;border-radius:28px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 18px 50px rgba(15,23,42,0.10);">
            <tr>
              <td style="padding:28px;background:linear-gradient(135deg,#061524 0%,#0F172A 58%,#164E63 100%);color:#FFFFFF;">
                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(landingName)}" style="max-height:42px;max-width:170px;display:block;margin-bottom:24px;" />
                      <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(34,211,238,0.14);color:#A5F3FC;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
                        Raport z kalkulatora
                      </div>
                      <h1 style="margin:18px 0 0 0;font-size:30px;line-height:1.15;letter-spacing:-0.03em;">Twój wynik jest gotowy</h1>
                      <p style="margin:14px 0 0 0;color:#CBD5E1;font-size:16px;line-height:1.6;">${greeting} Poniżej znajduje się podsumowanie wstępnej analizy magazynu energii przygotowane na podstawie podanych danych.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px;">
                <div style="border-radius:24px;background:linear-gradient(135deg,#ECFEFF 0%,#F7FEE7 100%);border:1px solid #BAE6FD;padding:22px;">
                  <div style="font-size:12px;font-weight:800;color:#0369A1;text-transform:uppercase;letter-spacing:0.10em;">Rekomendacja</div>
                  <div style="margin-top:10px;font-size:28px;font-weight:900;line-height:1.15;color:#0F172A;">${escapeHtml(recommendation.title)}</div>
                  <p style="margin:14px 0 0 0;color:#334155;font-size:15px;line-height:1.65;">${escapeHtml(recommendation.description)}</p>
                  <div style="margin-top:16px;color:#475569;font-size:14px;line-height:1.6;">
                    <strong>Szacowany okres zwrotu:</strong> ${escapeHtml(formatPaybackYears(result.paybackYearsLow, result.paybackYearsHigh))}
                  </div>
                </div>

                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin-top:18px;">
                  <tr>${metricsHtml}</tr>
                </table>

                <div style="margin-top:22px;border:1px solid #E5E7EB;border-radius:22px;overflow:hidden;background:#FFFFFF;">
                  <div style="padding:16px 18px;background:#F8FAFC;border-bottom:1px solid #E5E7EB;font-weight:900;font-size:16px;color:#0F172A;">Twoje odpowiedzi</div>
                  <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                    ${answersRowsHtml}
                  </table>
                </div>

                <div style="margin-top:22px;border-radius:22px;background:#F8FAFC;border:1px solid #E2E8F0;padding:20px;">
                  <h2 style="margin:0;font-size:20px;color:#0F172A;">Co dalej?</h2>
                  <p style="margin:12px 0 0 0;color:#334155;font-size:15px;line-height:1.7;">
                    Otrzymaliśmy zgłoszenie wraz z prośbą o kontakt telefoniczny. Doradca przeanalizuje wynik i skontaktuje się, aby potwierdzić dobór magazynu energii, omówić możliwości uzyskania dotacji oraz odpowiedzieć na dodatkowe pytania.
                  </p>
                </div>

                <div style="margin-top:24px;text-align:center;">
                  <a href="${escapeHtml(landingUrl)}" style="display:inline-block;background:#0F172A;color:#FFFFFF;text-decoration:none;padding:14px 22px;border-radius:16px;font-weight:900;">
                    Poznaj więcej rozwiązań
                  </a>
                </div>

                <p style="margin:24px 0 0 0;color:#64748B;font-size:12px;line-height:1.6;text-align:center;">
                  Wynik ma charakter orientacyjny i nie stanowi oferty handlowej. Dokładny dobór magazynu energii wymaga analizy profilu zużycia, warunków technicznych oraz aktualnych zasad dofinansowania.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_FROM || smtpUser,
    to: email,
    subject: "Twój wynik z kalkulatora magazynu energii",
    html,
  });
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
  const delegatedRefreshToken = process.env.MICROSOFT_DELEGATED_REFRESH_TOKEN?.trim();

  try {
    if (delegatedRefreshToken) {
      const delegatedToken = await refreshMicrosoftDelegatedAccessToken(delegatedRefreshToken);

      await sendTeamsDelegatedLeadChannelNotification({
        message: channelMessage,
        accessToken: delegatedToken.access_token || "",
      });
    } else {
      await sendTeamsLeadChannelNotification({
        message: channelMessage,
      });
    }
  } catch (error) {
    console.error("energy-storage-lead Teams channel notification failed", error);
  }

  if (!params.advisor.email) {
    return;
  }

  const directMessage = buildTeamsEnergyStorageLeadDirectMessage(notificationPayload);

  try {

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
    const turnstileToken = cleanText(contact.turnstileToken);
    const honeypot = cleanText(contact.honeypot);
    const email = cleanText(contact.email).toLowerCase() || null;

    if (honeypot) {
      console.warn("energy-storage-lead honeypot triggered");
      return NextResponse.json(
        { ok: true, skipped: true },
        { headers: getCorsHeaders(request) }
      );
    }

    if (!firstName || phone.replace(/\D/g, "").length < 9 || !/^\d{2}-\d{3}$/.test(postalCode)) {
      return NextResponse.json(
        { error: "Nieprawidłowe dane kontaktowe." },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const isTurnstileValid = await verifyTurnstileToken(turnstileToken, request);

    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: "Nie udało się zweryfikować zabezpieczenia formularza." },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    const duplicateLead = await findRecentDuplicateLead(phone, email);

    if (duplicateLead) {
      console.warn("energy-storage-lead duplicate skipped", duplicateLead.id);
      return NextResponse.json(
        { ok: true, duplicate: true, clientId: duplicateLead.id },
        { headers: getCorsHeaders(request) }
      );
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
    try {
      await sendLeadResultEmail(payload);
    } catch (error) {
      console.error("energy-storage-lead email failed", error);
    }

    return NextResponse.json(
      { ok: true, clientId: clientResult.clientId },
      { headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error("energy-storage-lead error", error);
    return NextResponse.json(
      { error: "Nie udało się zapisać zgłoszenia." },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}