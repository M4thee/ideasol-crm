import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CODE_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const CODE_LENGTH = 4;
const MAX_CREATE_ATTEMPTS = 12;
const MAX_URL_LENGTH = 4096;

type ShortLinkInput = {
  destinationUrl?: string;
};

type ShortLinkUpdateInput = {
  id?: string;
  isActive?: boolean;
};

function createCode() {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  ).join("");
}

function normalizeDestinationUrl(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Wklej prawidłowy adres URL.");
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.length > MAX_URL_LENGTH) {
    throw new Error("Adres URL jest pusty albo zbyt długi.");
  }

  let destinationUrl: URL;

  try {
    destinationUrl = new URL(trimmedValue);
  } catch {
    throw new Error("Adres musi zaczynać się od http:// lub https://.");
  }

  if (!["http:", "https:"].includes(destinationUrl.protocol)) {
    throw new Error("Dozwolone są wyłącznie linki http:// i https://.");
  }

  if (!destinationUrl.hostname) {
    throw new Error("Adres URL nie zawiera prawidłowej domeny.");
  }

  return destinationUrl.toString();
}

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("short_links")
    .select(
      "id,code,destination_url,is_active,click_count,created_at,updated_at,last_clicked_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: `Nie udało się pobrać skróconych linków: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest(request);

  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  let input: ShortLinkInput;

  try {
    input = (await request.json()) as ShortLinkInput;
  } catch {
    return NextResponse.json(
      { error: "Nieprawidłowy format danych." },
      { status: 400 }
    );
  }

  let destinationUrl: string;

  try {
    destinationUrl = normalizeDestinationUrl(input.destinationUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nieprawidłowy adres URL.",
      },
      { status: 400 }
    );
  }

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const code = createCode();
    const { data, error } = await supabaseAdmin
      .from("short_links")
      .insert({
        code,
        destination_url: destinationUrl,
        created_by: admin.id,
      })
      .select(
        "id,code,destination_url,is_active,click_count,created_at,updated_at,last_clicked_at"
      )
      .single();

    if (!error) {
      return NextResponse.json({ link: data }, { status: 201 });
    }

    if (error.code !== "23505") {
      return NextResponse.json(
        { error: `Nie udało się skrócić linku: ${error.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Nie udało się wylosować wolnego kodu. Spróbuj ponownie." },
    { status: 503 }
  );
}

export async function PATCH(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  let input: ShortLinkUpdateInput;

  try {
    input = (await request.json()) as ShortLinkUpdateInput;
  } catch {
    return NextResponse.json(
      { error: "Nieprawidłowy format danych." },
      { status: 400 }
    );
  }

  if (!input.id || typeof input.isActive !== "boolean") {
    return NextResponse.json(
      { error: "Podaj link i jego nowy status." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("short_links")
    .update({
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select(
      "id,code,destination_url,is_active,click_count,created_at,updated_at,last_clicked_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `Nie udało się zmienić statusu linku: ${error.message}` },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Nie znaleziono skróconego linku." },
      { status: 404 }
    );
  }

  return NextResponse.json({ link: data });
}
