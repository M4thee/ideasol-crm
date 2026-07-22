import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { LeadAssignmentRule } from "@/lib/leadIntegrations";

const VALID_RULES = new Set<LeadAssignmentRule>([
  "random",
  "postal_code",
  "round_robin",
]);

type IntegrationInput = {
  id?: string;
  slug?: string;
  name?: string;
  sourceType?: string;
  campaignName?: string;
  externalFormId?: string | null;
  isActive?: boolean;
  assignmentRule?: LeadAssignmentRule;
  tagNames?: string[];
  participantUserIds?: string[];
  notifyAssignedUser?: boolean;
  notifyOwners?: boolean;
};

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) return null;

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") return null;
  return profile;
}

function validateInput(input: IntegrationInput, creating = false) {
  const errors: string[] = [];

  if (creating && !input.slug?.trim()) errors.push("Podaj identyfikator integracji.");
  if (creating && !input.sourceType?.trim()) errors.push("Podaj źródło integracji.");
  if (!input.name?.trim()) errors.push("Podaj nazwę integracji.");
  if (!input.campaignName?.trim()) errors.push("Podaj nazwę kampanii.");
  if (!input.assignmentRule || !VALID_RULES.has(input.assignmentRule)) {
    errors.push("Wybierz prawidłową zasadę przydzielania leadów.");
  }
  if (!Array.isArray(input.participantUserIds) || input.participantUserIds.length === 0) {
    errors.push("Wybierz co najmniej jednego użytkownika do obsługi leadów.");
  }
  if (!Array.isArray(input.tagNames) || input.tagNames.length === 0) {
    errors.push("Wybierz co najmniej jeden tag klienta.");
  }

  return errors;
}

async function validateParticipants(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,is_active,hidden_from_assignment")
    .in("id", uniqueIds);

  if (error) throw error;

  const validIds = new Set(
    (data ?? [])
      .filter(
        (profile) =>
          profile.is_active !== false && profile.hidden_from_assignment !== true
      )
      .map((profile) => profile.id)
  );

  return uniqueIds.filter((id) => validIds.has(id));
}

async function validateTags(tagNames: string[]) {
  const uniqueNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  const { data, error } = await supabaseAdmin
    .from("client_tags")
    .select("name")
    .in("name", uniqueNames)
    .eq("is_active", true);

  if (error) throw error;

  return (data ?? []).map((tag) => tag.name);
}

async function replaceParticipants(integrationId: string, userIds: string[]) {
  const { error: deleteError } = await supabaseAdmin
    .from("lead_integration_users")
    .delete()
    .eq("integration_id", integrationId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabaseAdmin
    .from("lead_integration_users")
    .insert(
      userIds.map((userId, index) => ({
        integration_id: integrationId,
        user_id: userId,
        position: index,
      }))
    );

  if (insertError) throw insertError;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const [integrationsResult, linksResult, profilesResult, tagsResult] = await Promise.all([
    supabaseAdmin
      .from("lead_integrations")
      .select(
        "id,slug,name,source_type,campaign_name,external_form_id,is_active,assignment_rule,tag_names,notify_assigned_user,notify_owners,updated_at"
      )
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("lead_integration_users")
      .select("integration_id,user_id,position")
      .order("position", { ascending: true }),
    supabaseAdmin
      .from("profiles")
      .select("id,display_name,email,role,is_active,hidden_from_assignment")
      .in("role", ["seller", "manager", "owner"])
      .order("display_name", { ascending: true }),
    supabaseAdmin
      .from("client_tags")
      .select("name,color")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const firstError =
    integrationsResult.error || linksResult.error || profilesResult.error || tagsResult.error;

  if (firstError) {
    return NextResponse.json(
      { error: `Nie udało się pobrać konfiguracji: ${firstError.message}` },
      { status: 500 }
    );
  }

  const participantsByIntegration = new Map<string, string[]>();
  for (const link of linksResult.data ?? []) {
    const current = participantsByIntegration.get(link.integration_id) ?? [];
    current.push(link.user_id);
    participantsByIntegration.set(link.integration_id, current);
  }

  return NextResponse.json({
    integrations: (integrationsResult.data ?? []).map((integration) => ({
      ...integration,
      participant_user_ids: participantsByIntegration.get(integration.id) ?? [],
    })),
    users: (profilesResult.data ?? []).filter(
      (profile) =>
        profile.is_active !== false && profile.hidden_from_assignment !== true
    ),
    tags: tagsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const input = (await request.json()) as IntegrationInput;
  const validationErrors = validateInput(input, true);

  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join(" ") }, { status: 400 });
  }

  try {
    const participantIds = await validateParticipants(input.participantUserIds ?? []);
    const tagNames = await validateTags(input.tagNames ?? []);

    if (input.sourceType === "meta" && !input.externalFormId?.trim()) {
      const { data: existingDefault } = await supabaseAdmin
        .from("lead_integrations")
        .select("id")
        .eq("source_type", "meta")
        .is("external_form_id", null)
        .maybeSingle();

      if (existingDefault) {
        return NextResponse.json(
          { error: "Istnieje już domyślna integracja Meta. Dla kolejnej kampanii podaj ID formularza." },
          { status: 400 }
        );
      }
    }

    if (input.externalFormId?.trim()) {
      const { data: duplicateForm } = await supabaseAdmin
        .from("lead_integrations")
        .select("id")
        .eq("source_type", input.sourceType!.trim())
        .eq("external_form_id", input.externalFormId.trim())
        .maybeSingle();

      if (duplicateForm) {
        return NextResponse.json(
          { error: "Ten formularz jest już przypisany do innej integracji." },
          { status: 400 }
        );
      }
    }

    if (participantIds.length !== new Set(input.participantUserIds ?? []).size) {
      return NextResponse.json(
        { error: "Co najmniej jeden wybrany użytkownik jest nieaktywny lub niedostępny." },
        { status: 400 }
      );
    }

    if (tagNames.length !== new Set(input.tagNames ?? []).size) {
      return NextResponse.json(
        { error: "Co najmniej jeden wybrany tag nie istnieje lub jest nieaktywny." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("lead_integrations")
      .insert({
        slug: input.slug!.trim(),
        name: input.name!.trim(),
        source_type: input.sourceType!.trim(),
        campaign_name: input.campaignName!.trim(),
        external_form_id: input.externalFormId?.trim() || null,
        is_active: input.isActive !== false,
        assignment_rule: input.assignmentRule,
        tag_names: tagNames,
        notify_assigned_user: input.notifyAssignedUser !== false,
        notify_owners: input.notifyOwners !== false,
      })
      .select("id")
      .single();

    if (error) throw error;
    await replaceParticipants(data.id, participantIds);

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error("[LEAD INTEGRATIONS ADMIN] POST", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się utworzyć integracji." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const input = (await request.json()) as IntegrationInput;
  const validationErrors = validateInput(input);

  if (!input.id) validationErrors.unshift("Brakuje identyfikatora integracji.");
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join(" ") }, { status: 400 });
  }

  try {
    const integrationId = input.id!;
    const participantIds = await validateParticipants(input.participantUserIds ?? []);
    const tagNames = await validateTags(input.tagNames ?? []);

    if (participantIds.length !== new Set(input.participantUserIds ?? []).size) {
      return NextResponse.json(
        { error: "Co najmniej jeden wybrany użytkownik jest nieaktywny lub niedostępny." },
        { status: 400 }
      );
    }

    if (tagNames.length !== new Set(input.tagNames ?? []).size) {
      return NextResponse.json(
        { error: "Co najmniej jeden wybrany tag nie istnieje lub jest nieaktywny." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("lead_integrations")
      .update({
        name: input.name!.trim(),
        campaign_name: input.campaignName!.trim(),
        external_form_id: input.externalFormId?.trim() || null,
        is_active: input.isActive !== false,
        assignment_rule: input.assignmentRule,
        tag_names: tagNames,
        notify_assigned_user: input.notifyAssignedUser !== false,
        notify_owners: input.notifyOwners !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId);

    if (error) throw error;
    await replaceParticipants(integrationId, participantIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LEAD INTEGRATIONS ADMIN] PATCH", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się zapisać integracji." },
      { status: 500 }
    );
  }
}
