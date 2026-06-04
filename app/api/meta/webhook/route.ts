import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type MetaLeadField = {
  name?: string;
  values?: string[];
};

type NormalizedMetaLead = {
  fullName: string | null;
  phone: string | null;
  postalCode: string | null;
  singleFamilyHouse: string | null;
  yearlyElectricityBills: string | null;
  hasPhotovoltaics: string | null;
  preferredContactTime: string | null;
  rawFieldData: MetaLeadField[];
};

type LeadAssignment = {
  userId: string | null;
  status: "assigned_to_nearest_user" | "assigned_to_fallback_cc";
  distanceKm: number | null;
};

const FALLBACK_CC_NAME = "Kamil Wiśniewski";
const META_LEAD_TAG_NAME = "MetaADS";
const POLAND_COUNTRY_CODE = "pl";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function extractLeadgenIds(body: any): string[] {
  const ids: string[] = [];

  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const leadgenId = change?.value?.leadgen_id;

      if (leadgenId) {
        ids.push(String(leadgenId));
      }
    }
  }

  return ids;
}

async function saveMetaLead(
  leadgenId: string,
  body: any,
  assignmentStatus = "received"
) {
  const { error } = await supabaseAdmin
    .from("meta_leads")
    .upsert(
      {
        meta_lead_id: leadgenId,
        raw_payload: body,
        assignment_status: assignmentStatus,
      },
      {
        onConflict: "meta_lead_id",
      }
    );

  if (error) {
    console.error("[META WEBHOOK] saveMetaLead", error);
  }
}

function normalizeFieldName(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getFieldValue(fields: MetaLeadField[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeFieldName);

  for (const field of fields) {
    const normalizedName = normalizeFieldName(field.name);

    if (normalizedCandidates.includes(normalizedName)) {
      return field.values?.[0]?.trim() || null;
    }
  }

  return null;
}

function normalizePostalCode(value: string | null) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  const digits = normalizedValue.replace(/[^0-9]/g, "");

  if (digits.length !== 5) {
    return normalizedValue;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  firstLat: number,
  firstLng: number,
  secondLat: number,
  secondLng: number
) {
  const earthRadiusKm = 6371;
  const latDifference = toRadians(secondLat - firstLat);
  const lngDifference = toRadians(secondLng - firstLng);

  const a =
    Math.sin(latDifference / 2) * Math.sin(latDifference / 2) +
    Math.cos(toRadians(firstLat)) *
      Math.cos(toRadians(secondLat)) *
      Math.sin(lngDifference / 2) *
      Math.sin(lngDifference / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

async function getCachedPostalGeocode(postalCode: string) {
  const { data, error } = await supabaseAdmin
    .from("postal_geocodes")
    .select("lat,lng")
    .eq("postal_code", postalCode)
    .maybeSingle();

  if (error) {
    console.error("[META WEBHOOK] getCachedPostalGeocode", error);
  }

  if (!data?.lat || !data?.lng) {
    return null;
  }

  return {
    lat: Number(data.lat),
    lng: Number(data.lng),
  };
}

async function savePostalGeocode(
  postalCode: string,
  lat: number,
  lng: number,
  city?: string | null
) {
  const { error } = await supabaseAdmin
    .from("postal_geocodes")
    .upsert(
      {
        postal_code: postalCode,
        city: city ?? null,
        lat,
        lng,
        source: "nominatim",
      },
      {
        onConflict: "postal_code",
      }
    );

  if (error) {
    console.error("[META WEBHOOK] savePostalGeocode", error);
  }
}

async function geocodePostalCode(postalCode: string | null) {
  const normalizedPostalCode = normalizePostalCode(postalCode);

  if (!normalizedPostalCode) {
    return null;
  }

  const cachedGeocode = await getCachedPostalGeocode(normalizedPostalCode);

  if (cachedGeocode) {
    return cachedGeocode;
  }

  const params = new URLSearchParams({
    postalcode: normalizedPostalCode,
    countrycodes: POLAND_COUNTRY_CODE,
    format: "jsonv2",
    limit: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "IdeaSolCRM/1.0 (Meta Lead Ads webhook)",
      },
    }
  );

  if (!response.ok) {
    console.error(
      `[META WEBHOOK] geocodePostalCode failed ${normalizedPostalCode}: ${response.status}`
    );
    return null;
  }

  const results = await response.json();
  const firstResult = Array.isArray(results) ? results[0] : null;

  if (!firstResult?.lat || !firstResult?.lon) {
    return null;
  }

  const lat = Number(firstResult.lat);
  const lng = Number(firstResult.lon);

  await savePostalGeocode(
    normalizedPostalCode,
    lat,
    lng,
    firstResult?.address?.city ?? firstResult?.address?.town ?? null
  );

  return { lat, lng };
}

function normalizeMetaLead(fields: MetaLeadField[]): NormalizedMetaLead {
  return {
    fullName: getFieldValue(fields, [
      "full_name",
      "full name",
      "imie_i_nazwisko",
      "imię i nazwisko",
    ]),
    phone: getFieldValue(fields, [
      "phone_number",
      "phone",
      "numer_telefonu",
      "telefon",
    ]),
    postalCode: normalizePostalCode(
      getFieldValue(fields, [
        "kod_pocztowy_inwestycji",
        "kod pocztowy inwestycji",
        "kod_pocztowy",
        "kod pocztowy",
      ])
    ),
    singleFamilyHouse: getFieldValue(fields, [
      "czy_mieszkasz_w_domu_jednorodzinnym",
      "czy mieszkasz w domu jednorodzinnym",
    ]),
    yearlyElectricityBills: getFieldValue(fields, [
      "jakie_sa_twoje_roczne_rachunki_za_energie_elektryczna",
      "jakie są twoje roczne rachunki za energię elektryczną",
      "ile_wynosza_twoje_roczne_rachunki_za_prad",
      "ile wynoszą twoje roczne rachunki za prąd",
    ]),
    hasPhotovoltaics: getFieldValue(fields, [
      "czy_posiadasz_instalacje_fotowoltaiczna",
      "czy posiadasz instalację fotowoltaiczną",
      "czy_masz_fotowoltaike",
      "czy masz fotowoltaikę",
    ]),
    preferredContactTime: getFieldValue(fields, [
      "kiedy_najwygodniej_sie_z_toba_skontaktowac",
      "kiedy najwygodniej się z tobą skontaktować",
      "kiedy_moge_do_ciebie_zadzwonic",
      "kiedy mogę do ciebie zadzwonić",
    ]),
    rawFieldData: fields,
  };
}

async function fetchMetaLead(leadgenId: string) {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("Missing META_PAGE_ACCESS_TOKEN");
  }

  const apiVersion = process.env.META_GRAPH_API_VERSION || "v20.0";
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${leadgenId}?access_token=${accessToken}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Meta lead fetch failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function findFallbackCcUserId() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("display_name", FALLBACK_CC_NAME)
    .maybeSingle();

  if (error) {
    console.error("[META WEBHOOK] findFallbackCcUserId", error);
  }

  return data?.id ?? null;
}

async function findNearestAssignableUserId(postalCode: string | null): Promise<LeadAssignment> {
  const fallbackCcUserId = await findFallbackCcUserId();
  const leadGeocode = await geocodePostalCode(postalCode);

  if (!leadGeocode) {
    return {
      userId: fallbackCcUserId,
      status: "assigned_to_fallback_cc",
      distanceKm: null,
    };
  }

  const { data: locations, error: locationsError } = await supabaseAdmin
    .from("user_service_locations")
    .select("user_id,postal_code,radius_km");

  if (locationsError) {
    console.error("[META WEBHOOK] findNearestAssignableUserId locations", locationsError);
    return {
      userId: fallbackCcUserId,
      status: "assigned_to_fallback_cc",
      distanceKm: null,
    };
  }

  const userIds = Array.from(
    new Set((locations ?? []).map((location: any) => location.user_id).filter(Boolean))
  );

  if (userIds.length === 0) {
    return {
      userId: fallbackCcUserId,
      status: "assigned_to_fallback_cc",
      distanceKm: null,
    };
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,role,is_active,hidden_from_assignment")
    .in("id", userIds);

  if (profilesError) {
    console.error("[META WEBHOOK] findNearestAssignableUserId profiles", profilesError);
    return {
      userId: fallbackCcUserId,
      status: "assigned_to_fallback_cc",
      distanceKm: null,
    };
  }

  const assignableUserIds = new Set(
    (profiles ?? [])
      .filter((profile: any) =>
        ["seller", "manager", "owner"].includes(profile.role) &&
        profile.is_active !== false &&
        profile.hidden_from_assignment !== true
      )
      .map((profile: any) => profile.id)
  );

  let bestMatch: { userId: string; distanceKm: number } | null = null;

  for (const location of locations ?? []) {
    if (!assignableUserIds.has(location.user_id)) {
      continue;
    }

    const locationGeocode = await geocodePostalCode(location.postal_code);

    if (!locationGeocode) {
      continue;
    }

    const distanceKm = calculateDistanceKm(
      leadGeocode.lat,
      leadGeocode.lng,
      locationGeocode.lat,
      locationGeocode.lng
    );

    const radiusKm = Number(location.radius_km ?? 80);

    if (distanceKm > radiusKm) {
      continue;
    }

    if (!bestMatch || distanceKm < bestMatch.distanceKm) {
      bestMatch = {
        userId: location.user_id,
        distanceKm,
      };
    }
  }

  if (!bestMatch) {
    return {
      userId: fallbackCcUserId,
      status: "assigned_to_fallback_cc",
      distanceKm: null,
    };
  }

  return {
    userId: bestMatch.userId,
    status: "assigned_to_nearest_user",
    distanceKm: Math.round(bestMatch.distanceKm * 10) / 10,
  };
}

async function findMetaAdsTagId() {
  const { data, error } = await supabaseAdmin
    .from("client_tags")
    .select("id")
    .eq("name", META_LEAD_TAG_NAME)
    .maybeSingle();

  if (error) {
    console.error("[META WEBHOOK] findMetaAdsTagId", error);
  }

  return data?.id ?? null;
}

async function attachMetaAdsTag(clientId: string) {
  const tagId = await findMetaAdsTagId();

  if (!tagId) {
    console.error("[META WEBHOOK] MetaADS tag not found");
    return;
  }

  const { error } = await supabaseAdmin
    .from("client_tag_links")
    .upsert(
      {
        client_id: clientId,
        tag_id: tagId,
      },
      {
        onConflict: "client_id,tag_id",
      }
    );

  if (error) {
    console.error("[META WEBHOOK] attachMetaAdsTag", error);
  }
}

async function createClientFromMetaLead(
  lead: NormalizedMetaLead,
  assignedUserId: string | null
) {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      full_name: lead.fullName || "Lead MetaADS",
      phone: lead.phone,
      postal_code: lead.postalCode,
      status: assignedUserId ? "Przypisany" : "Nowy lead",
      assigned_user_id: assignedUserId,
      lead_source: META_LEAD_TAG_NAME,
      notes: [
        "Lead z Meta Ads.",
        `Dom jednorodzinny: ${lead.singleFamilyHouse ?? "brak danych"}`,
        `Roczne rachunki: ${lead.yearlyElectricityBills ?? "brak danych"}`,
        `Fotowoltaika: ${lead.hasPhotovoltaics ?? "brak danych"}`,
        `Preferowana pora kontaktu: ${lead.preferredContactTime ?? "brak danych"}`,
      ].join("\n"),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await attachMetaAdsTag(data.id);

  return data.id as string;
}

async function processLeadgenId(leadgenId: string, webhookBody: any) {
  await saveMetaLead(leadgenId, webhookBody, "received");

  const metaLead = await fetchMetaLead(leadgenId);
  const fieldData = (metaLead?.field_data ?? []) as MetaLeadField[];
  const normalizedLead = normalizeMetaLead(fieldData);
  const assignment = await findNearestAssignableUserId(normalizedLead.postalCode);

  const clientId = await createClientFromMetaLead(normalizedLead, assignment.userId);

  await supabaseAdmin
    .from("meta_leads")
    .update({
      client_id: clientId,
      assigned_user_id: assignment.userId,
      raw_payload: metaLead,
      form_answers: normalizedLead,
      assignment_status: assignment.status,
    })
    .eq("meta_lead_id", leadgenId);

  return {
    leadgenId,
    clientId,
    assignedUserId: assignment.userId,
    assignmentStatus: assignment.status,
    distanceKm: assignment.distanceKm,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const entries = body?.entry ?? [];
  const leadgenIds = extractLeadgenIds(body);

  console.log(
    `[META WEBHOOK] received ${entries.length} entries`
  );

  console.log("[META WEBHOOK]", JSON.stringify(body, null, 2));

  const { error: systemLogError } = await supabaseAdmin.from("system_logs").insert({
    source: "meta_webhook",
    message: "Webhook received",
    payload: body,
  });

  if (systemLogError) {
    console.error("[META WEBHOOK] system_logs", systemLogError);
  }

  const processedLeads = [];

  for (const leadgenId of leadgenIds) {
    try {
      processedLeads.push(await processLeadgenId(leadgenId, body));
    } catch (error) {
      console.error(`[META WEBHOOK] processLeadgenId ${leadgenId}`, error);

      await saveMetaLead(leadgenId, body, "error");
    }
  }

  console.log(
    `[META WEBHOOK] processed ${processedLeads.length} lead ids`
  );

  return NextResponse.json({
    success: true,
    entries: entries.length,
    leadgenIds,
    processedLeads,
  });
}