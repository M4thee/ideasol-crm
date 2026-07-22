import { supabaseAdmin } from "@/lib/supabase/admin";

export type LeadAssignmentRule = "random" | "postal_code" | "round_robin";

export type LeadIntegration = {
  id: string;
  slug: string;
  name: string;
  source_type: string;
  campaign_name: string;
  external_form_id: string | null;
  assignment_rule: LeadAssignmentRule;
  tag_names: string[];
  field_mapping: Record<string, string[]>;
  notify_assigned_user: boolean;
  notify_owners: boolean;
};

export type AssignableLeadUser = {
  id: string;
  email: string | null;
  display_name: string | null;
};

export type LeadAssignmentResult = {
  user: AssignableLeadUser | null;
  requestedRule: LeadAssignmentRule;
  appliedRule: LeadAssignmentRule | "none";
  fallbackReason: string | null;
};

type Coordinates = { lat: number; lng: number };

export async function findLeadIntegration(
  sourceType: string,
  identifiers: { formId?: string | null; slug?: string | null } = {}
) {
  let query = supabaseAdmin
    .from("lead_integrations")
    .select(
      "id,slug,name,source_type,campaign_name,external_form_id,assignment_rule,tag_names,field_mapping,notify_assigned_user,notify_owners"
    )
    .eq("source_type", sourceType)
    .eq("is_active", true);

  if (identifiers.slug) {
    query = query.eq("slug", identifiers.slug);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Nie udało się pobrać konfiguracji integracji leadów: ${error.message}`);
  }

  const integrations = (data ?? []) as LeadIntegration[];

  if (identifiers.formId) {
    const exactMatch = integrations.find(
      (integration) => integration.external_form_id === identifiers.formId
    );

    if (exactMatch) return exactMatch;
  }

  return integrations.find((integration) => !integration.external_form_id) ?? null;
}

async function getEligibleUsers(integrationId: string) {
  const { data: links, error: linksError } = await supabaseAdmin
    .from("lead_integration_users")
    .select("user_id,position")
    .eq("integration_id", integrationId)
    .order("position", { ascending: true });

  if (linksError) {
    throw new Error(`Nie udało się pobrać uczestników integracji: ${linksError.message}`);
  }

  const userIds = (links ?? []).map((link) => link.user_id).filter(Boolean);

  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,display_name,is_active,hidden_from_assignment")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(`Nie udało się pobrać użytkowników integracji: ${profilesError.message}`);
  }

  const order = new Map(userIds.map((id, index) => [id, index]));

  return (profiles ?? [])
    .filter(
      (profile) =>
        profile.is_active !== false && profile.hidden_from_assignment !== true
    )
    .sort((first, second) =>
      (order.get(first.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(second.id) ?? Number.MAX_SAFE_INTEGER)
    ) as AssignableLeadUser[];
}

async function getProfile(userId: string | null) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Nie udało się pobrać przypisanego użytkownika: ${error.message}`);
  }

  return (data as AssignableLeadUser | null) ?? null;
}

async function claimRoundRobinUser(integrationId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_next_lead_integration_user",
    { p_integration_id: integrationId }
  );

  if (error) {
    throw new Error(`Nie udało się przydzielić leada na zmianę: ${error.message}`);
  }

  return getProfile(typeof data === "string" ? data : null);
}

function normalizePostalCode(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : null;
}

function calculateDistanceKm(first: Coordinates, second: Coordinates) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const latitudeDifference = toRadians(second.lat - first.lat);
  const longitudeDifference = toRadians(second.lng - first.lng);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getPostalCoordinates(postalCode: string): Promise<Coordinates | null> {
  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (!normalizedPostalCode) return null;

  const { data: knownLocations, error } = await supabaseAdmin
    .from("postal_code_locations")
    .select("latitude,longitude")
    .eq("postal_code", normalizedPostalCode)
    .limit(100);

  if (error) {
    console.error("[LEAD ASSIGNMENT] postal_code_locations", error);
    return null;
  }

  const validLocations = (knownLocations ?? []).filter(
    (location) =>
      Number.isFinite(Number(location.latitude)) &&
      Number.isFinite(Number(location.longitude))
  );

  if (validLocations.length === 0) return null;

  return {
    lat:
      validLocations.reduce((sum, location) => sum + Number(location.latitude), 0) /
      validLocations.length,
    lng:
      validLocations.reduce((sum, location) => sum + Number(location.longitude), 0) /
      validLocations.length,
  };
}

async function findNearestParticipant(
  postalCode: string | null | undefined,
  eligibleUsers: AssignableLeadUser[]
) {
  const leadCoordinates = postalCode
    ? await getPostalCoordinates(postalCode)
    : null;

  if (!leadCoordinates) return null;

  const eligibleIds = new Set(eligibleUsers.map((user) => user.id));
  const { data: serviceLocations, error } = await supabaseAdmin
    .from("user_service_locations")
    .select("user_id,postal_code,radius_km")
    .in("user_id", [...eligibleIds]);

  if (error) {
    throw new Error(`Nie udało się pobrać lokalizacji użytkowników: ${error.message}`);
  }

  let nearest: { userId: string; distanceKm: number } | null = null;

  for (const serviceLocation of serviceLocations ?? []) {
    if (!eligibleIds.has(serviceLocation.user_id)) continue;

    const userCoordinates = await getPostalCoordinates(serviceLocation.postal_code);
    if (!userCoordinates) continue;

    const distanceKm = calculateDistanceKm(leadCoordinates, userCoordinates);
    const radiusKm = Number(serviceLocation.radius_km ?? 80);

    if (distanceKm > radiusKm) continue;
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { userId: serviceLocation.user_id, distanceKm };
    }
  }

  return nearest ? getProfile(nearest.userId) : null;
}

export async function assignLead(
  integration: LeadIntegration,
  input: { postalCode?: string | null }
): Promise<LeadAssignmentResult> {
  const eligibleUsers = await getEligibleUsers(integration.id);

  if (eligibleUsers.length === 0) {
    return {
      user: null,
      requestedRule: integration.assignment_rule,
      appliedRule: "none",
      fallbackReason: "Brak aktywnych użytkowników przypisanych do integracji.",
    };
  }

  if (integration.assignment_rule === "random") {
    const randomIndex = Math.floor(Math.random() * eligibleUsers.length);
    return {
      user: eligibleUsers[randomIndex],
      requestedRule: "random",
      appliedRule: "random",
      fallbackReason: null,
    };
  }

  if (integration.assignment_rule === "postal_code") {
    const nearestUser = await findNearestParticipant(
      input.postalCode,
      eligibleUsers
    );

    if (nearestUser) {
      return {
        user: nearestUser,
        requestedRule: "postal_code",
        appliedRule: "postal_code",
        fallbackReason: null,
      };
    }

    return {
      user: await claimRoundRobinUser(integration.id),
      requestedRule: "postal_code",
      appliedRule: "round_robin",
      fallbackReason:
        "Nie udało się dopasować lokalizacji; zastosowano równy przydział na zmianę.",
    };
  }

  return {
    user: await claimRoundRobinUser(integration.id),
    requestedRule: "round_robin",
    appliedRule: "round_robin",
    fallbackReason: null,
  };
}

export async function attachIntegrationTags(clientId: string, tagNames: string[]) {
  const normalizedNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  if (normalizedNames.length === 0) return;

  const { data: tags, error: tagsError } = await supabaseAdmin
    .from("client_tags")
    .select("id,name")
    .in("name", normalizedNames)
    .eq("is_active", true);

  if (tagsError) {
    throw new Error(`Nie udało się pobrać tagów integracji: ${tagsError.message}`);
  }

  const missingTags = normalizedNames.filter(
    (name) => !(tags ?? []).some((tag) => tag.name === name)
  );

  if (missingTags.length > 0) {
    throw new Error(`Brakuje aktywnych tagów: ${missingTags.join(", ")}`);
  }

  const { error: linksError } = await supabaseAdmin.from("client_tag_links").upsert(
    (tags ?? []).map((tag) => ({ client_id: clientId, tag_id: tag.id })),
    { onConflict: "client_id,tag_id" }
  );

  if (linksError) {
    throw new Error(`Nie udało się przypisać tagów do klienta: ${linksError.message}`);
  }
}

export async function getLeadNotificationOwners() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,display_name")
    .eq("role", "owner")
    .eq("is_active", true);

  if (error) {
    throw new Error(`Nie udało się pobrać właścicieli do powiadomienia: ${error.message}`);
  }

  return (data ?? []) as AssignableLeadUser[];
}
