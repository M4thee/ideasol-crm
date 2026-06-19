import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type OcrClientRow = {
  source_file_name: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  province: string | null;
  import_note: string | null;
  assigned_user_id: string | null;
  error: string | null;
};

type AdvisorLocation = {
  advisorName: string;
  postalCode: string;
};

type AdvisorProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type PostalCodeLocation = {
  postal_code: string;
  latitude: number;
  longitude: number;
  province: string | null;
};

const ADVISOR_POSTAL_CODES: AdvisorLocation[] = [
  { advisorName: "Mateusz Rapczewski", postalCode: "91-024" },
  { advisorName: "Mateusz Rapczewski", postalCode: "34-300" },
  { advisorName: "Janusz Uchwat", postalCode: "29-100" },
  { advisorName: "Paweł Czupryński", postalCode: "25-015" },
  { advisorName: "Jan Osmenda", postalCode: "32-089" },
  { advisorName: "Michał Brodziński", postalCode: "32-060" },
  { advisorName: "Aleksandra Jachowicz", postalCode: "32-444" },
];

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeNameForMatch(value: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  return text.replace(/\D/g, "");
}

function normalizePostalCode(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/\b\d{2}-\d{3}\b/);
  return match?.[0] || null;
}

function cleanDetectedPostalCode(value: string | null): string | null {
  if (!value) return null;

  const normalized = value
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/[^0-9-]/g, "");

  const directMatch = normalized.match(/\b\d{2}-\d{3}\b/);
  if (directMatch) return directMatch[0];

  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 5) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}`;
  }

  return null;
}

function sanitizeEmail(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const blockedEmailFragments = [
    "columbusenergy",
    "columbusone",
    "columbuselite",
  ];

  const lower = text.toLowerCase();

  if (blockedEmailFragments.some((fragment) => lower.includes(fragment))) {
    return null;
  }

  return text;
}

function normalizeProvinceName(value: string | null): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const normalized = text
    .replace(/Ł/g, "L")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const provinceMap: Record<string, string> = {
    dolnoslaskie: "Dolnośląskie",
    "lower silesia": "Dolnośląskie",
    "lower silesian": "Dolnośląskie",
    "lower silesian voivodeship": "Dolnośląskie",

    "kujawsko pomorskie": "Kujawsko-pomorskie",
    "kuyavian pomeranian": "Kujawsko-pomorskie",
    "kuyavian pomeranian voivodeship": "Kujawsko-pomorskie",

    lubelskie: "Lubelskie",
    lublin: "Lubelskie",
    "lublin voivodeship": "Lubelskie",

    lubuskie: "Lubuskie",
    lubusz: "Lubuskie",
    "lubusz voivodeship": "Lubuskie",

    lodzkie: "Łódzkie",
    lodz: "Łódzkie",
    "lodz province": "Łódzkie",
    "lodz region": "Łódzkie",
    "lodz voivodeship": "Łódzkie",

    malopolskie: "Małopolskie",
    "lesser poland": "Małopolskie",
    "lesser poland voivodeship": "Małopolskie",

    mazowieckie: "Mazowieckie",
    mazovia: "Mazowieckie",
    masovia: "Mazowieckie",
    masovian: "Mazowieckie",
    "mazovia voivodeship": "Mazowieckie",
    "masovia voivodeship": "Mazowieckie",
    "masovian voivodeship": "Mazowieckie",

    opolskie: "Opolskie",
    opole: "Opolskie",
    "opole voivodeship": "Opolskie",

    podkarpackie: "Podkarpackie",
    subcarpathian: "Podkarpackie",
    "subcarpathian voivodeship": "Podkarpackie",

    podlaskie: "Podlaskie",
    podlasie: "Podlaskie",
    "podlaskie voivodeship": "Podlaskie",

    pomorskie: "Pomorskie",
    pomeranian: "Pomorskie",
    "pomeranian voivodeship": "Pomorskie",

    slaskie: "Śląskie",
    silesia: "Śląskie",
    silesian: "Śląskie",
    "silesian voivodeship": "Śląskie",

    swietokrzyskie: "Świętokrzyskie",
    "holy cross": "Świętokrzyskie",
    "holy cross voivodeship": "Świętokrzyskie",

    "warminsko mazurskie": "Warmińsko-mazurskie",
    "warmian masurian": "Warmińsko-mazurskie",
    "warmian masurian voivodeship": "Warmińsko-mazurskie",

    wielkopolskie: "Wielkopolskie",
    "greater poland": "Wielkopolskie",
    "greater poland voivodeship": "Wielkopolskie",

    zachodniopomorskie: "Zachodniopomorskie",
    "west pomeranian": "Zachodniopomorskie",
    "west pomeranian voivodeship": "Zachodniopomorskie",
  };

  return provinceMap[normalized] || text;
}

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${file.type || "image/jpeg"};base64,${base64}`;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function findAdvisorProfileIdByName(
  supabase: any,
  advisorName: string
): Promise<string | null> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("is_active", true);

  if (error) {
    console.error("Nie udało się pobrać profili doradców dla OCR:", error);
    return null;
  }

  const normalizedAdvisorName = normalizeNameForMatch(advisorName);

  const exactMatch = (profiles as AdvisorProfile[] | null)?.find(
    (profile) => normalizeNameForMatch(profile.display_name) === normalizedAdvisorName
  );

  if (exactMatch) return exactMatch.id;

  const partialMatch = (profiles as AdvisorProfile[] | null)?.find((profile) => {
    const normalizedDisplayName = normalizeNameForMatch(profile.display_name);
    return (
      normalizedDisplayName.includes(normalizedAdvisorName) ||
      normalizedAdvisorName.includes(normalizedDisplayName)
    );
  });

  if (partialMatch) return partialMatch.id;

  console.warn(`Nie znaleziono profilu doradcy OCR: ${advisorName}`);
  return null;
}

async function findPostalCodeLocation(
  supabase: any,
  postalCode: string
): Promise<PostalCodeLocation | null> {
  const cleanedCode = cleanDetectedPostalCode(postalCode);
  if (!cleanedCode) return null;

  const { data: exactLocation, error: exactError } = await supabase
    .from("postal_code_locations")
    .select("postal_code, latitude, longitude, province")
    .eq("postal_code", cleanedCode)
    .maybeSingle();

  if (exactError) {
    console.error(`Błąd szukania kodu OCR ${cleanedCode}:`, exactError);
  }

  if (exactLocation) return exactLocation as PostalCodeLocation;

  const prefix = cleanedCode.slice(0, 2);

  const { data: fallbackLocations, error: fallbackError } = await supabase
    .from("postal_code_locations")
    .select("postal_code, latitude, longitude, province")
    .like("postal_code", `${prefix}-%`)
    .limit(1);

  if (fallbackError) {
    console.error(`Błąd fallbacku kodu OCR ${cleanedCode}:`, fallbackError);
  }

  return (fallbackLocations?.[0] as PostalCodeLocation | undefined) || null;
}

async function assignAdvisorByPostalCode(postalCode: string | null) {
  if (!postalCode) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const targetLocation = await findPostalCodeLocation(supabase, postalCode);

  if (!targetLocation) {
    console.warn(`Nie znaleziono lokalizacji kodu klienta OCR: ${postalCode}`);
    return null;
  }

  let nearestAdvisorName: string | null = null;
  let nearestDistance = Number.MAX_VALUE;

  for (const advisor of ADVISOR_POSTAL_CODES) {
    const advisorLocation = await findPostalCodeLocation(
      supabase,
      advisor.postalCode
    );

    if (!advisorLocation) {
      console.warn(
        `Nie znaleziono lokalizacji kodu doradcy OCR: ${advisor.advisorName} / ${advisor.postalCode}`
      );
      continue;
    }

    // Wzór Haversine dla dokładniejszego obliczania km
    const R = 6371;
    const dLat = (advisorLocation.latitude - targetLocation.latitude) * Math.PI / 180;
    const dLon = (advisorLocation.longitude - targetLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(targetLocation.latitude * Math.PI / 180) * Math.cos(advisorLocation.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestAdvisorName = advisor.advisorName;
    }
  }

  if (!nearestAdvisorName) return null;

  const advisorProfileId = await findAdvisorProfileIdByName(
    supabase,
    nearestAdvisorName
  );

  if (!advisorProfileId) {
    console.warn(
      `Nie udało się dopasować profilu doradcy OCR po nazwie: ${nearestAdvisorName}`
    );
  }

  return advisorProfileId;
}

async function analyzeImage(file: File): Promise<OcrClientRow> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      source_file_name: file.name,
      full_name: null,
      phone: null,
      email: null,
      city: null,
      address: null,
      postal_code: null,
      province: null,
      import_note: null,
      assigned_user_id: null,
      error: "Brak OPENAI_API_KEY",
    };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const imageUrl = await fileToDataUrl(file);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Jesteś precyzyjnym modułem OCR dla systemu CRM. Zwracasz wyłącznie czysty JSON bez formatowania markdown.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                'Odczytaj dane klienta ze zdjęcia/screena z systemu spotkań. Zwróć wyłącznie JSON z następującymi polami: {"full_name":string|null,"phone":string|null,"email":string|null,"street":string|null,"house_number":string|null,"city":string|null,"postal_code":string|null,"import_note":string|null}.\n\n' +
                'STREFE WYTYCZNE DLA ADRESU KLIENTA:\n' +
                '1. "street": Podaj tylko nazwę ulicy lub samej miejscowości (jeśli ulica nie występuje). Nie dopisuj tu kodu pocztowego, numeru domu ani miasta.\n' +
                '2. "house_number": Podaj wyłącznie numer domu / lokalu / działki.\n' +
                '3. "city": Podaj wyłącznie nazwę miejscowości/miasta.\n' +
                '4. "postal_code": Podaj strictly kod pocztowy KLIENTA (format XX-XXX). UWAGA: Na screenie mogą znajdować się kody pocztowe doradców (np. Mateusz, Janusz itp.) lub numery ID systemu. Kategorycznie je zignoruj! Wyciągnij tylko ten kod, który jest bezpośrednim elementem adresu zamieszkania/montażu klienta.\n\n' +
                'POZOSTAŁE ZASADY:\n' +
                '- Email odczytaj jako osobne pole email tylko wtedy, gdy jest to email klienta. Ignoruj emaile zawierające columbusenergy, columbusone albo columbuselite.\n' +
                '- Pole import_note ma zawierać wszystkie informacje sprzedażowe i opisowe widoczne na screenie poza podstawowymi danymi klienta, czyli m.in. produkt, rachunek, właściciel licznika, umowa kompleksowa, pokrycie dachowe, informacje dodatkowe, treść sekcji "Spotkanie handlowe", "Opis", "Uwagi". Właściciel licznika zawsze ma trafić do import_note, nie jako osobne pole. Nie traktuj pola "Notatka: Brak" jako powodu do pustej notatki, jeżeli wyżej na ekranie są informacje opisowe. Godziny spotkania pomiń, chyba że są częścią szerszego opisu.',
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = safeJsonParse(content) as {
      full_name?: unknown;
      phone?: unknown;
      email?: unknown;
      street?: unknown;
      house_number?: unknown;
      city?: unknown;
      postal_code?: unknown;
      import_note?: unknown;
    } | null;

    // Pobieramy wyczyszczony kod pocztowy prosto ze struktury JSON modelu
    const detectedPostalCode = normalizePostalCode(parsed?.postal_code);

    // Na podstawie poprawnego kodu pocztowego klienta przypisujemy najbliższego doradcę
    const assignedAdvisorId = await assignAdvisorByPostalCode(detectedPostalCode);

    let detectedProvince: string | null = null;

    if (detectedPostalCode) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const location = await findPostalCodeLocation(
          supabase,
          detectedPostalCode
        );

        detectedProvince = normalizeProvinceName(location?.province || null);
      }
    }

    // Łączymy ulicę i numer domu w jedno pole tekstowe "address", które leci do tabeli podglądu
    const streetStr = normalizeText(parsed?.street);
    const houseNumStr = normalizeText(parsed?.house_number);
    const cleanAddress = [streetStr, houseNumStr].filter(Boolean).join(" ");

    return {
      source_file_name: file.name,
      full_name: normalizeText(parsed?.full_name),
      phone: normalizePhone(parsed?.phone),
      email: sanitizeEmail(parsed?.email),
      city: normalizeText(parsed?.city),
      address: cleanAddress || null,
      postal_code: detectedPostalCode,
      province: normalizeProvinceName(detectedProvince),
      import_note: normalizeText(parsed?.import_note),
      assigned_user_id: assignedAdvisorId,
      error: null,
    };
  } catch (error) {
    console.error(error);

    return {
      source_file_name: file.name,
      full_name: null,
      phone: null,
      email: null,
      city: null,
      address: null,
      postal_code: null,
      province: null,
      import_note: null,
      assigned_user_id: null,
      error: "Nie udało się przeanalizować zdjęcia",
    };
  }
}


export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const files = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ rows: [] }, { status: 400 });
    }

    const rows = await Promise.all(files.map((file) => analyzeImage(file)));

    return NextResponse.json({ rows });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        rows: [],
        error: "Import zdjęć nie powiódł się",
      },
      { status: 500 }
    );
  }
}