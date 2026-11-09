import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeServicePostalCode } from "@/lib/userServiceLocations";

const ROLES = ["seller", "manager", "owner"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getCodeDetails(postalCode: string) {
  const { data, error } = await supabaseAdmin
    .from("postal_code_locations")
    .select("city,province,latitude,longitude")
    .eq("postal_code", postalCode)
    .limit(100);
  if (error) throw error;

  return {
    places: [...new Set((data ?? []).map((row) =>
      [row.city, row.province].filter(Boolean).join(", ")
    ).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl")),
    has_coordinates: (data ?? []).some((row) =>
      row.latitude !== null && row.longitude !== null &&
      Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))
    ),
  };
}

function serverError(error: unknown) {
  console.error("[ADMIN POSTAL CODES]", error);
  return NextResponse.json(
    { error: "Nie udało się zapisać lub odczytać lokalizacji. Spróbuj ponownie." },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdminRequest(request))) {
      return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
    }
    const [profiles, permissions, locations] = await Promise.all([
      supabaseAdmin.from("profiles")
        .select("id,display_name,role,is_active,hidden_from_assignment")
        .in("role", ROLES).order("display_name"),
      supabaseAdmin.from("user_permissions").select("user_id,ideasol,ideatermo"),
      supabaseAdmin.from("user_service_locations")
        .select("id,user_id,postal_code").order("postal_code"),
    ]);
    if (profiles.error) throw profiles.error;
    if (permissions.error) throw permissions.error;
    if (locations.error) throw locations.error;

    const codes = [...new Set((locations.data ?? []).map((row) => row.postal_code))];
    const details = new Map(await Promise.all(codes.map(async (code) =>
      [code, await getCodeDetails(code)] as const
    )));
    const access = new Map((permissions.data ?? []).map((row) => [row.user_id, row]));
    return NextResponse.json({
      users: (profiles.data ?? []).map((profile) => ({
        ...profile,
        is_active: profile.is_active !== false,
        hidden_from_assignment: profile.hidden_from_assignment === true,
        ideasol: access.get(profile.id)?.ideasol === true,
        ideatermo: access.get(profile.id)?.ideatermo === true,
        locations: (locations.data ?? []).filter((row) => row.user_id === profile.id)
          .map((row) => ({ ...row, ...details.get(row.postal_code) })),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}

async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  try {
    if (!(await requireAdminRequest(request))) {
      return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
    }
    let input: { userId?: unknown; id?: unknown; postalCode?: unknown };
    try {
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
      input = body;
    } catch {
      return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });
    }
    if (typeof input.userId !== "string" || !UUID.test(input.userId) ||
      (method !== "POST" && (typeof input.id !== "string" || !UUID.test(input.id)))) {
      return NextResponse.json({ error: "Nieprawidłowy użytkownik lub lokalizacja." }, { status: 400 });
    }
    const { data: user, error: userError } = await supabaseAdmin.from("profiles")
      .select("id").eq("id", input.userId).in("role", ROLES).maybeSingle();
    if (userError) throw userError;
    if (!user) {
      return NextResponse.json({ error: "Nie znaleziono doradcy." }, { status: 404 });
    }

    // Scope every edit/removal to the selected user, including stale UI requests.
    if (method !== "POST") {
      const { data: existing, error } = await supabaseAdmin.from("user_service_locations")
        .select("id").eq("id", input.id as string).eq("user_id", input.userId).maybeSingle();
      if (error) throw error;
      if (!existing) {
        return NextResponse.json({ error: "Nie znaleziono lokalizacji tego użytkownika. Odśwież listę." }, { status: 404 });
      }
    }
    if (method === "DELETE") {
      const { data, error } = await supabaseAdmin.from("user_service_locations")
        .delete().eq("id", input.id as string).eq("user_id", input.userId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Lokalizacja została już usunięta." }, { status: 404 });
      return NextResponse.json({ success: true, id: data.id });
    }

    const postalCode = normalizeServicePostalCode(input.postalCode);
    if (!postalCode) {
      return NextResponse.json({ error: "Wpisz kod pocztowy w formacie 00-000." }, { status: 400 });
    }
    const details = await getCodeDetails(postalCode);
    if (!details.has_coordinates) {
      return NextResponse.json({
        error: "Nie znaleziono współrzędnych tego kodu w bazie lokalizacji. Sprawdź kod przed zapisaniem.",
      }, { status: 400 });
    }
    let duplicates = supabaseAdmin.from("user_service_locations").select("id")
      .eq("user_id", input.userId).eq("postal_code", postalCode);
    if (method === "PATCH") duplicates = duplicates.neq("id", input.id as string);
    const { data: duplicate, error: duplicateError } = await duplicates.limit(1);
    if (duplicateError) throw duplicateError;
    if (duplicate?.length) {
      return NextResponse.json({ error: "Ten kod jest już przypisany do tego użytkownika." }, { status: 409 });
    }

    // Preserve the existing radius; postal lead assignment uses the location itself.
    const query = method === "POST"
      ? supabaseAdmin.from("user_service_locations").insert({ user_id: input.userId, postal_code: postalCode })
      : supabaseAdmin.from("user_service_locations").update({ postal_code: postalCode })
        .eq("id", input.id as string).eq("user_id", input.userId);
    const { data, error } = await query.select("id,user_id,postal_code").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Lokalizacja nie jest już dostępna. Odśwież listę." }, { status: 404 });
    return NextResponse.json({ location: { ...data, ...details } }, { status: method === "POST" ? 201 : 200 });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) { return mutate(request, "POST"); }
export async function PATCH(request: Request) { return mutate(request, "PATCH"); }
export async function DELETE(request: Request) { return mutate(request, "DELETE"); }
