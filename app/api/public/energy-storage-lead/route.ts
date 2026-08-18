import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendMetaCrmEvent } from "@/lib/metaConversions";
import {
  assignLead,
  attachIntegrationTags,
  findLeadIntegration,
  type AssignableLeadUser,
} from "@/lib/leadIntegrations";
import {
  buildTeamsEnergyStorageLeadChannelMessage,
  buildTeamsEnergyStorageLeadDirectMessage,
  sendTeamsBoardMetaLeadNotification,
  sendTeamsDirectEnergyStorageLeadNotification,
} from "@/lib/microsoftTeams";

type LeadPayload = {
  source?: string;
  contact?: {
    firstName?: string;
    lastName?: string | null;
    postalCode?: string;
    phone?: string;
    email?: string | null;
    turnstileToken?: string | null;
  };
  answers?: {
    hasPv?: "yes" | "no" | null;
    pvPower?: string | null;
    settlementSystem?: "net_billing" | "net_metering" | "unknown" | null;
    billMode?: "monthly" | "yearly";
    billAmount?: string;
    yearlyBill?: number;
    yearlyConsumptionKwh?: number;
    tariff?: string | null;
    priorities?: string[];
  };
  result?: {
    recommendationType?: "recommended" | "consider" | "not_recommended";
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
    paybackYearsWithoutSubsidyLow?: number;
    paybackYearsWithoutSubsidyHigh?: number;
  };
  meta?: {
    eventId?: string;
    eventSourceUrl?: string;
    fbp?: string | null;
    fbc?: string | null;
  };
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://magazyny.ideasol.pl",
  "https://www.ideasol.pl",
  "https://ideasol.pl",
];

function getAllowedOrigins() {
  const configuredOrigins =
    process.env.PUBLIC_LEAD_ALLOWED_ORIGINS?.split(",")
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
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: unknown) {
  const numberValue = typeof value === "number" ? value : 0;
  return `${Math.round(numberValue).toLocaleString("pl-PL")} zł`;
}

function formatPaybackYears(low: unknown, high: unknown) {
  const lowValue = typeof low === "number" ? low : null;
  const highValue = typeof high === "number" ? high : null;

  if (lowValue === null && highValue === null) return "Brak danych";
  if (lowValue !== null && highValue !== null && lowValue === highValue) return `około ${lowValue} lat`;
  if (lowValue !== null && highValue !== null) return `${lowValue}-${highValue} lat`;
  return `${lowValue ?? highValue} lat`;
}

function formatHasPv(value: "yes" | "no" | null | undefined) {
  if (value === "yes") return "TAK";
  if (value === "no") return "NIE";
  return "Brak danych";
}

function formatSettlementSystem(value: "net_billing" | "net_metering" | "unknown" | null | undefined) {
  if (value === "net_billing") return "Net-billing";
  if (value === "net_metering") return "Net-metering";
  return "Nie wiem / brak danych";
}

async function verifyTurnstileToken(token: string, request: Request) {
  const secretKey =
    process.env.TURNSTILE_SECRET_KEY?.trim() ||
    process.env.URNSTILE_SECRET_KEY?.trim();

  if (!secretKey) {
    console.warn("energy-storage-lead Turnstile skipped - secret key not configured");
    return true;
  }

  if (!token) return false;

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (ip) formData.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) return false;

  const result = (await response.json()) as { success?: boolean };
  return Boolean(result.success);
}

function buildAnalysisNote(payload: LeadPayload) {
  const contact = payload.contact ?? {};
  const answers = payload.answers ?? {};
  const result = payload.result ?? {};

  return [
    "Źródło: Kalkulator magazynu energii — magazyny.ideasol.pl",
    "",
    "Dane kontaktowe:",
    `Imię: ${cleanText(contact.firstName) || "brak"}`,
    `Nazwisko: ${cleanText(contact.lastName) || "brak"}`,
    `Telefon: ${cleanText(contact.phone) || "brak"}`,
    `E-mail: ${cleanText(contact.email) || "brak"}`,
    `Kod pocztowy: ${cleanText(contact.postalCode) || "brak"}`,
    "",
    "Odpowiedzi z kalkulatora:",
    `Posiada PV: ${formatHasPv(answers.hasPv)}`,
    `Moc PV: ${answers.pvPower ? `${answers.pvPower} kWp` : "brak / nie dotyczy"}`,
    `System rozliczeń: ${formatSettlementSystem(answers.settlementSystem)}`,
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
    `Szacowany okres zwrotu: ${formatPaybackYears(result.paybackYearsLow, result.paybackYearsHigh)}`,
  ].join("\n");
}

function buildCustomerEmailText(payload: LeadPayload) {
  const contact = payload.contact ?? {};
  const answers = payload.answers ?? {};
  const result = payload.result ?? {};
  const firstName = cleanText(contact.firstName);

  return [
    firstName ? `Dzień dobry, ${firstName}!` : "Dzień dobry!",
    "",
    "Twój wynik z kalkulatora magazynu energii jest gotowy.",
    "",
    result.recommendationTitle || "Wynik wstępnej analizy magazynu energii",
    `Rekomendowany magazyn: ${result.recommendedStorageKwh ? `${result.recommendedStorageKwh} kWh` : "do potwierdzenia"}`,
    `Sugerowana moc PV: ${result.suggestedPvKw ? `${result.suggestedPvKw} kWp` : "do potwierdzenia"}`,
    `Szacowana roczna korzyść: ${formatMoney(result.yearlySavingsLow)}–${formatMoney(result.yearlySavingsHigh)}`,
    `Orientacyjny koszt: ${formatMoney(result.priceLow)}–${formatMoney(result.priceHigh)}`,
    `Możliwa dotacja: ${result.subsidyEstimate ? `do ${formatMoney(result.subsidyEstimate)}` : "do weryfikacji"}`,
    `Szacowany okres zwrotu: ${formatPaybackYears(result.paybackYearsLow, result.paybackYearsHigh)}`,
    "",
    `Rachunek za energię: ${answers.billAmount || "brak danych"} zł ${answers.billMode === "yearly" ? "rocznie" : "miesięcznie"}`,
    `Szacowane zużycie roczne: ${answers.yearlyConsumptionKwh ? `${Math.round(answers.yearlyConsumptionKwh).toLocaleString("pl-PL")} kWh` : "brak danych"}`,
    `Taryfa: ${answers.tariff || "brak danych"}`,
    `Najważniejsze cele: ${answers.priorities?.length ? answers.priorities.join(", ") : "nie wskazano"}`,
    "",
    "Doradca IdeaSol skontaktuje się z Tobą, aby potwierdzić parametry instalacji, dobrać sprzęt i przygotować finalną kalkulację z dotacją.",
    "",
    "https://magazyny.ideasol.pl",
    "",
    "Wynik ma charakter orientacyjny i nie stanowi oferty handlowej.",
    "IdeaSol Sp. z o.o. · Kielce · ideasol.pl",
  ].join("\n");
}

async function findRecentLeadByPhone(phone: string) {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("phone", phone)
    .eq("lead_source", "kalkulatorME")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("energy-storage-lead duplicate check failed", error);
    throw error;
  }

  return data?.id as string | undefined;
}

async function insertLeadIntoCrm(
  payload: LeadPayload,
  assignedUser: AssignableLeadUser | null
) {
  const contact = payload.contact ?? {};
  const firstName = cleanText(contact.firstName);
  const lastName = cleanText(contact.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || firstName;
  const phone = cleanText(contact.phone);
  const email = cleanText(contact.email).toLowerCase() || null;
  const postalCode = cleanText(contact.postalCode);

  const duplicateClientId = await findRecentLeadByPhone(phone);

  if (duplicateClientId) {
    return { clientId: duplicateClientId, duplicate: true };
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      client_type: "B2C",
      full_name: fullName,
      contact_person: fullName,
      phone,
      contact_phone: phone,
      email,
      postal_code: postalCode,
      status: assignedUser ? "Przypisany" : "Nowy lead",
      is_lead: true,
      lead_source: "kalkulatorME",
      assigned_user_id: assignedUser?.id || null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("energy-storage-lead CRM insert failed", error);
    throw error || new Error("CRM insert did not return a client id.");
  }

  const { error: noteError } = await supabaseAdmin.from("client_notes").insert({
    client_id: data.id,
    content: buildAnalysisNote(payload),
  });

  if (noteError) {
    console.error("energy-storage-lead note insert failed", noteError);
  }

  return { clientId: data.id as string, duplicate: false };
}

function buildHtmlEmail(payload: LeadPayload) {
  const contact = payload.contact ?? {};
  const answers = payload.answers ?? {};
  const result = payload.result ?? {};
  const firstName = cleanText(contact.firstName);
  const greeting = firstName ? `Dzień dobry, ${escapeHtml(firstName)}!` : "Dzień dobry!";
  const recommendation = result.recommendationType ?? "consider";
  const recommendationLabel =
    recommendation === "recommended"
      ? "Rekomendujemy magazyn energii"
      : recommendation === "not_recommended"
        ? "Na ten moment nie rekomendujemy"
        : "Warto rozważyć magazyn energii";
  const recommendationColor = recommendation === "not_recommended" ? "#B42318" : "#067647";
  const recommendationBackground = recommendation === "not_recommended" ? "#FEF3F2" : "#ECFDF3";
  const recommendationBorder = recommendation === "not_recommended" ? "#FECDCA" : "#ABEFC6";
  const recommendedStorage = result.recommendedStorageKwh
    ? `${result.recommendedStorageKwh.toLocaleString("pl-PL")} kWh`
    : "Do potwierdzenia";
  const suggestedPv = result.suggestedPvKw
    ? `${result.suggestedPvKw.toLocaleString("pl-PL")} kWp`
    : answers.hasPv === "yes"
      ? answers.pvPower
        ? `${escapeHtml(answers.pvPower)} kWp`
        : "Instalacja istniejąca"
      : "Do potwierdzenia";
  const yearlySavings = `${formatMoney(result.yearlySavingsLow)}–${formatMoney(result.yearlySavingsHigh)}`;
  const investmentCost = `${formatMoney(result.priceLow)}–${formatMoney(result.priceHigh)}`;
  const subsidy = result.subsidyEstimate ? `do ${formatMoney(result.subsidyEstimate)}` : "Do weryfikacji";
  const payback = formatPaybackYears(result.paybackYearsLow, result.paybackYearsHigh);
  const yearlyConsumption = answers.yearlyConsumptionKwh
    ? `${Math.round(answers.yearlyConsumptionKwh).toLocaleString("pl-PL")} kWh`
    : "Brak danych";
  const bill = answers.billAmount
    ? `${escapeHtml(answers.billAmount)} zł ${answers.billMode === "yearly" ? "rocznie" : "miesięcznie"}`
    : "Brak danych";
  const priorities = answers.priorities?.length
    ? answers.priorities.map((priority) => escapeHtml(priority)).join(", ")
    : "Nie wskazano";

  return `
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Twój wynik z kalkulatora magazynu energii</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .mobile-padding { padding-left: 22px !important; padding-right: 22px !important; }
        .hero-title { font-size: 29px !important; line-height: 1.12 !important; }
        .stack-column { display: block !important; width: 100% !important; box-sizing: border-box !important; }
        .stack-spacer { height: 10px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#F3F6F8;font-family:Arial,Helvetica,sans-serif;color:#102A2E;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Rekomendacja, dobór magazynu, oszczędności, koszt i możliwa dotacja — Twój wynik IdeaSol jest gotowy.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F3F6F8;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" class="email-shell" style="width:640px;max-width:640px;background:#FFFFFF;border:1px solid #DDE7E9;border-radius:22px;overflow:hidden;">
            <tr>
              <td class="mobile-padding" style="padding:22px 36px;background:#073B3A;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="92" style="width:92px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:14px;">
                        <tr>
                          <td style="padding:6px;">
                            <img src="https://crm.ideasol.pl/logo.png" width="78" height="76" alt="IdeaSol" style="display:block;width:78px;height:76px;border:0;outline:none;text-decoration:none;">
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" valign="middle" style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#B9D1CF;">Raport z kalkulatora</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:44px 36px 28px 36px;background:#073B3A;color:#FFFFFF;">
                <p style="margin:0 0 10px 0;font-size:16px;line-height:1.5;color:#D4E4E2;">${greeting}</p>
                <h1 class="hero-title" style="margin:0;font-size:38px;line-height:1.08;letter-spacing:-0.035em;color:#FFFFFF;">Twój wynik jest gotowy</h1>
                <p style="margin:18px 0 0 0;max-width:520px;font-size:16px;line-height:1.65;color:#D4E4E2;">Na podstawie podanych informacji przygotowaliśmy wstępny dobór rozwiązania dla Twojego domu.</p>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:32px 36px 0 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${recommendationBackground};border:1px solid ${recommendationBorder};border-radius:18px;">
                  <tr>
                    <td style="padding:24px;">
                      <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#FFFFFF;font-size:11px;font-weight:800;line-height:1;letter-spacing:0.08em;text-transform:uppercase;color:${recommendationColor};">${recommendationLabel}</div>
                      <h2 style="margin:16px 0 0 0;font-size:26px;line-height:1.22;letter-spacing:-0.025em;color:#102A2E;">${escapeHtml(result.recommendationTitle || "Wynik wstępnej analizy magazynu energii")}</h2>
                      <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#496368;">Szacowany okres zwrotu: <strong style="color:#102A2E;">${escapeHtml(payback)}</strong></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:30px 36px 0 36px;">
                <p style="margin:0 0 14px 0;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#557176;">Najważniejsze liczby</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="stack-column" width="50%" valign="top" style="width:50%;padding:18px;background:#F4F8F7;border:1px solid #DDE7E5;border-radius:14px;">
                      <div style="font-size:12px;line-height:1.4;color:#617B7F;">Rekomendowany magazyn</div>
                      <div style="margin-top:7px;font-size:23px;font-weight:800;line-height:1.2;color:#073B3A;">${recommendedStorage}</div>
                    </td>
                    <td class="stack-spacer" width="10" style="width:10px;font-size:1px;line-height:1px;">&nbsp;</td>
                    <td class="stack-column" width="50%" valign="top" style="width:50%;padding:18px;background:#F4F8F7;border:1px solid #DDE7E5;border-radius:14px;">
                      <div style="font-size:12px;line-height:1.4;color:#617B7F;">Szacowana roczna korzyść</div>
                      <div style="margin-top:7px;font-size:23px;font-weight:800;line-height:1.2;color:#073B3A;">${yearlySavings}</div>
                    </td>
                  </tr>
                  <tr><td colspan="3" height="10" style="height:10px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
                  <tr>
                    <td class="stack-column" width="50%" valign="top" style="width:50%;padding:18px;background:#F4F8F7;border:1px solid #DDE7E5;border-radius:14px;">
                      <div style="font-size:12px;line-height:1.4;color:#617B7F;">Orientacyjny koszt</div>
                      <div style="margin-top:7px;font-size:20px;font-weight:800;line-height:1.2;color:#073B3A;">${investmentCost}</div>
                    </td>
                    <td class="stack-spacer" width="10" style="width:10px;font-size:1px;line-height:1px;">&nbsp;</td>
                    <td class="stack-column" width="50%" valign="top" style="width:50%;padding:18px;background:#F1FCE5;border:1px solid #D5EFB4;border-radius:14px;">
                      <div style="font-size:12px;line-height:1.4;color:#55713A;">Możliwa dotacja</div>
                      <div style="margin-top:7px;font-size:23px;font-weight:800;line-height:1.2;color:#315B16;">${subsidy}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:32px 36px 0 36px;">
                <p style="margin:0 0 14px 0;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#557176;">Podsumowanie Twoich danych</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #DDE7E5;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;color:#617B7F;">Fotowoltaika</td>
                    <td align="right" style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;font-weight:700;color:#102A2E;">${escapeHtml(formatHasPv(answers.hasPv))}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;color:#617B7F;">Sugerowana moc PV</td>
                    <td align="right" style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;font-weight:700;color:#102A2E;">${suggestedPv}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;color:#617B7F;">Rachunek za energię</td>
                    <td align="right" style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;font-weight:700;color:#102A2E;">${bill}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;color:#617B7F;">Szacowane zużycie roczne</td>
                    <td align="right" style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;font-weight:700;color:#102A2E;">${yearlyConsumption}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;color:#617B7F;">Taryfa</td>
                    <td align="right" style="padding:13px 16px;border-bottom:1px solid #E7EEEC;font-size:13px;font-weight:700;color:#102A2E;">${escapeHtml(answers.tariff || "Brak danych")}</td>
                  </tr>
                  <tr>
                    <td valign="top" style="padding:13px 16px;font-size:13px;color:#617B7F;">Najważniejsze cele</td>
                    <td align="right" style="padding:13px 16px;font-size:13px;font-weight:700;line-height:1.45;color:#102A2E;">${priorities}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:32px 36px 0 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#073B3A;border-radius:16px;">
                  <tr>
                    <td style="padding:24px;color:#FFFFFF;">
                      <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#A9E65C;">Co dalej?</p>
                      <h2 style="margin:10px 0 0 0;font-size:22px;line-height:1.25;color:#FFFFFF;">Doradca IdeaSol zweryfikuje wynik</h2>
                      <p style="margin:12px 0 0 0;font-size:14px;line-height:1.65;color:#D4E4E2;">Skontaktujemy się z Tobą, aby potwierdzić parametry instalacji, dobrać konkretny sprzęt i przygotować finalną kalkulację z dotacją.</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                        <tr>
                          <td style="border-radius:10px;background:#A9E65C;">
                            <a href="https://magazyny.ideasol.pl" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:800;text-decoration:none;color:#17310A;">Wróć do kalkulatora</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:28px 36px 34px 36px;">
                <p style="margin:0;font-size:12px;line-height:1.65;text-align:center;color:#71878B;">Wynik ma charakter orientacyjny i nie stanowi oferty handlowej. Ostateczny dobór urządzeń, koszt i wysokość dotacji wymagają potwierdzenia przez doradcę.</p>
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;text-align:center;color:#9AABAE;">IdeaSol Sp. z o.o. · Kielce · <a href="https://ideasol.pl" style="color:#527176;text-decoration:underline;">ideasol.pl</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort === 587,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

async function sendLeadResultEmail(payload: LeadPayload) {
  const email = cleanText(payload.contact?.email);
  const transporter = createTransporter();

  if (!email || !transporter) return;

  const smtpFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Twój wynik magazynu energii | IdeaSol",
    text: buildCustomerEmailText(payload),
    html: buildHtmlEmail(payload),
  });
}

async function sendInternalLeadEmail(payload: LeadPayload) {
  const transporter = createTransporter();

  if (!transporter) return;

  const smtpFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: smtpFrom,
    to: process.env.LEAD_NOTIFICATION_EMAIL || smtpFrom,
    subject: "Nowy lead z kalkulatora magazynu energii",
    text: buildAnalysisNote(payload),
  });
}

function getTeamsLeadPayload(
  payload: LeadPayload,
  clientId: string,
  assignedUser: AssignableLeadUser | null
) {
  const contact = payload.contact ?? {};
  const clientName = [cleanText(contact.firstName), cleanText(contact.lastName)]
    .filter(Boolean)
    .join(" ") || "Brak imienia";
  const crmBaseUrl = (process.env.NEXT_PUBLIC_CRM_URL || "https://crm.ideasol.pl")
    .replace(/\/$/, "");

  return {
    advisorName: assignedUser?.display_name || assignedUser?.email || "Nie przypisano",
    clientName,
    clientPhone: cleanText(contact.phone),
    postalCode: cleanText(contact.postalCode),
    crmUrl: `${crmBaseUrl}/clients/${encodeURIComponent(clientId)}`,
  };
}

async function sendTeamsAdvisorNotification(
  payload: LeadPayload,
  clientId: string,
  assignedUser: AssignableLeadUser
) {
  if (!assignedUser.email) {
    throw new Error("Przypisany doradca nie ma adresu e-mail do powiadomienia Teams.");
  }

  return sendTeamsDirectEnergyStorageLeadNotification({
    userEmail: assignedUser.email,
    message: buildTeamsEnergyStorageLeadDirectMessage(
      getTeamsLeadPayload(payload, clientId, assignedUser)
    ),
  });
}

async function sendTeamsBoardNotification(
  payload: LeadPayload,
  clientId: string,
  assignedUser: AssignableLeadUser | null
) {
  return sendTeamsBoardMetaLeadNotification({
    message: buildTeamsEnergyStorageLeadChannelMessage(
      getTeamsLeadPayload(payload, clientId, assignedUser)
    ),
  });
}

function limitedHeader(value: string | null, maxLength = 1000) {
  return cleanText(value).slice(0, maxLength) || null;
}

async function sendMetaLeadEvent(
  payload: LeadPayload,
  clientId: string,
  request: Request
) {
  const eventId = cleanText(payload.meta?.eventId).slice(0, 128);
  if (!eventId) {
    console.warn("[META CAPI] Lead bez event_id - pomijam wysyłkę.");
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("meta_capi_events")
    .select("id, status, attempts, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  const pendingIsFresh =
    existing?.status === "pending" &&
    Date.now() - new Date(existing.updated_at).getTime() < 5 * 60_000;

  if (existing?.status === "sent" || pendingIsFresh) return;

  let eventRecordId = existing?.id as string | undefined;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("meta_capi_events")
      .update({
        status: "pending",
        attempts: (existing.attempts || 0) + 1,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) console.error("[META CAPI] Nie udało się odświeżyć zdarzenia Lead:", error);
  } else {
    const { data, error } = await supabaseAdmin
      .from("meta_capi_events")
      .insert({
        event_id: eventId,
        event_name: "Lead",
        source_type: "calculator_lead",
        source_id: clientId,
        client_id: clientId,
        status: "pending",
        attempts: 1,
      })
      .select("id")
      .maybeSingle();

    eventRecordId = data?.id as string | undefined;
    if (error) {
      console.error("[META CAPI] Nie udało się zarejestrować zdarzenia Lead:", error);
    }
  }

  try {
    const contact = payload.contact ?? {};
    const result = payload.result ?? {};
    const answers = payload.answers ?? {};
    const fullName = [cleanText(contact.firstName), cleanText(contact.lastName)]
      .filter(Boolean)
      .join(" ");
    const clientIpAddress =
      limitedHeader(request.headers.get("x-client-ip"), 64) ||
      limitedHeader(request.headers.get("cf-connecting-ip"), 64) ||
      limitedHeader(request.headers.get("x-forwarded-for")?.split(",")[0] || null, 64);
    const clientUserAgent =
      limitedHeader(request.headers.get("x-client-user-agent")) ||
      limitedHeader(request.headers.get("user-agent"));

    const metaResult = await sendMetaCrmEvent({
      eventName: "Lead",
      eventId,
      user: {
        externalId: clientId,
        fullName,
        phone: cleanText(contact.phone),
        phoneCountryCode: "48",
        email: cleanText(contact.email) || null,
        postalCode: cleanText(contact.postalCode),
        clientIpAddress,
        clientUserAgent,
        fbp: cleanText(payload.meta?.fbp).slice(0, 256) || null,
        fbc: cleanText(payload.meta?.fbc).slice(0, 256) || null,
      },
      sourceUrl: cleanText(payload.meta?.eventSourceUrl).slice(0, 2048) || null,
      customData: {
        content_name: "energy_storage_calculator_lead",
        content_category: "lead_form",
        recommendation_type: result.recommendationType || null,
        recommended_storage_kwh: result.recommendedStorageKwh,
        has_pv: answers.hasPv || null,
      },
    });

    if (eventRecordId) {
      await supabaseAdmin
        .from("meta_capi_events")
        .update({
          status: "sent",
          meta_trace_id: metaResult.fbtrace_id || null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventRecordId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[META CAPI] Wysyłka Lead nie powiodła się:", {
      eventId,
      error: message,
    });

    if (eventRecordId) {
      await supabaseAdmin
        .from("meta_capi_events")
        .update({
          status: "failed",
          last_error: message.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventRecordId);
    }

    throw error;
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

    const integration = await findLeadIntegration("calculator", {
      slug: "calculator-energy-storage",
    });
    const assignment = integration
      ? await assignLead(integration, { postalCode })
      : null;
    const assignedUser = assignment?.user || null;
    const crmResult = await insertLeadIntoCrm(payload, assignedUser);

    if (crmResult.duplicate) {
      return NextResponse.json(
        { ok: true, duplicate: true, clientId: crmResult.clientId },
        { headers: getCorsHeaders(request) }
      );
    }

    if (integration) {
      await attachIntegrationTags(crmResult.clientId, integration.tag_names);
    }

    const notifications: Array<{ name: string; promise: Promise<unknown> }> = [
      {
        name: "meta_capi",
        promise: sendMetaLeadEvent(payload, crmResult.clientId, request),
      },
      { name: "internal_email", promise: sendInternalLeadEmail(payload) },
      { name: "lead_email", promise: sendLeadResultEmail(payload) },
    ];

    if (integration?.notify_assigned_user && assignedUser) {
      notifications.push({
        name: "teams_assigned_user",
        promise: sendTeamsAdvisorNotification(payload, crmResult.clientId, assignedUser),
      });
    }

    if (integration?.notify_owners) {
      notifications.push({
        name: "teams_board_chat",
        promise: sendTeamsBoardNotification(payload, crmResult.clientId, assignedUser),
      });
    }

    const results = await Promise.allSettled(
      notifications.map((notification) => notification.promise)
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error("energy-storage-lead notification failed", {
          notification: notifications[index]?.name,
          error: result.reason,
        });
      } else {
        console.info("energy-storage-lead notification succeeded", {
          notification: notifications[index]?.name,
        });
      }
    });

    return NextResponse.json(
      {
        ok: true,
        clientId: crmResult.clientId,
        assignedUserId: assignedUser?.id || null,
        assignedUserName: assignedUser?.display_name || null,
      },
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
