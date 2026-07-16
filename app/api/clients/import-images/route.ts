import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  { advisorName: "Aleksandra Jachowicz", postalCode: "42-439" },
];

const OCR_RETRY_DELAY_MS = 1200;
const OCR_MAX_FILES = 30;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeImageWithRetry(file: File): Promise<OcrClientRow> {
  const firstAttempt = await analyzeImage(file);

  if (!firstAttempt.error) {
    return firstAttempt;
  }

  console.warn(`Ponawiam OCR dla pliku ${file.name}: ${firstAttempt.error}`);
  await wait(OCR_RETRY_DELAY_MS);

  const secondAttempt = await analyzeImage(file);

  if (!secondAttempt.error) {
    return secondAttempt;
  }

  return firstAttempt;
}

async function analyzeImagesInBatches(files: File[]) {
  const rows: OcrClientRow[] = [];

  for (const file of files) {
    const row = await analyzeImageWithRetry(file);
    rows.push(row);
  }

  return rows;
}

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
    "dolny slask": "Dolnośląskie",
    "lower silesia": "Dolnośląskie",
    "lower silesian": "Dolnośląskie",
    "lower silesian province": "Dolnośląskie",
    "lower silesian region": "Dolnośląskie",
    "lower silesian voivodeship": "Dolnośląskie",

    "kujawsko pomorskie": "Kujawsko-pomorskie",
    "kujawy pomorze": "Kujawsko-pomorskie",
    "kuyavian pomeranian": "Kujawsko-pomorskie",
    "kuyavian pomeranian province": "Kujawsko-pomorskie",
    "kuyavian pomeranian region": "Kujawsko-pomorskie",
    "kuyavian pomeranian voivodeship": "Kujawsko-pomorskie",
    "cuyavian pomeranian": "Kujawsko-pomorskie",
    "cuyavian pomeranian voivodeship": "Kujawsko-pomorskie",

    lubelskie: "Lubelskie",
    lublin: "Lubelskie",
    "lublin province": "Lubelskie",
    "lublin region": "Lubelskie",
    "lublin voivodeship": "Lubelskie",

    lubuskie: "Lubuskie",
    lubusz: "Lubuskie",
    "lubusz province": "Lubuskie",
    "lubusz region": "Lubuskie",
    "lubusz voivodeship": "Lubuskie",

    lodzkie: "Łódzkie",
    lodz: "Łódzkie",
    "lodz province": "Łódzkie",
    "lodz region": "Łódzkie",
    "lodz voivodeship": "Łódzkie",

    malopolskie: "Małopolskie",
    malopolska: "Małopolskie",
    "lesser poland": "Małopolskie",
    "lesser poland province": "Małopolskie",
    "lesser poland region": "Małopolskie",
    "lesser poland voivodeship": "Małopolskie",

    mazowieckie: "Mazowieckie",
    mazowsze: "Mazowieckie",
    mazovia: "Mazowieckie",
    masovia: "Mazowieckie",
    masovian: "Mazowieckie",
    "mazovia province": "Mazowieckie",
    "mazovia region": "Mazowieckie",
    "mazovia voivodeship": "Mazowieckie",
    "masovia province": "Mazowieckie",
    "masovia region": "Mazowieckie",
    "masovia voivodeship": "Mazowieckie",
    "masovian province": "Mazowieckie",
    "masovian region": "Mazowieckie",
    "masovian voivodeship": "Mazowieckie",

    opolskie: "Opolskie",
    opole: "Opolskie",
    "opole province": "Opolskie",
    "opole region": "Opolskie",
    "opole voivodeship": "Opolskie",

    podkarpackie: "Podkarpackie",
    podkarpacie: "Podkarpackie",
    subcarpatia: "Podkarpackie",
    subcarpathia: "Podkarpackie",
    subcarpathian: "Podkarpackie",
    "subcarpatia province": "Podkarpackie",
    "subcarpatia region": "Podkarpackie",
    "subcarpatia voivodeship": "Podkarpackie",
    "subcarpathian province": "Podkarpackie",
    "subcarpathian region": "Podkarpackie",
    "subcarpathian voivodeship": "Podkarpackie",

    podlaskie: "Podlaskie",
    podlasie: "Podlaskie",
    "podlasie province": "Podlaskie",
    "podlasie region": "Podlaskie",
    "podlasie voivodeship": "Podlaskie",
    "podlaskie province": "Podlaskie",
    "podlaskie region": "Podlaskie",
    "podlaskie voivodeship": "Podlaskie",

    pomorskie: "Pomorskie",
    pomorze: "Pomorskie",
    pomerania: "Pomorskie",
    pomeranian: "Pomorskie",
    "pomerania province": "Pomorskie",
    "pomerania region": "Pomorskie",
    "pomerania voivodeship": "Pomorskie",
    "pomeranian province": "Pomorskie",
    "pomeranian region": "Pomorskie",
    "pomeranian voivodeship": "Pomorskie",

    slaskie: "Śląskie",
    slask: "Śląskie",
    silesia: "Śląskie",
    silesian: "Śląskie",
    "silesia province": "Śląskie",
    "silesia region": "Śląskie",
    "silesia voivodeship": "Śląskie",
    "silesian province": "Śląskie",
    "silesian region": "Śląskie",
    "silesian voivodeship": "Śląskie",

    swietokrzyskie: "Świętokrzyskie",
    "swiety krzyz": "Świętokrzyskie",
    "holy cross": "Świętokrzyskie",
    "holy cross province": "Świętokrzyskie",
    "holy cross region": "Świętokrzyskie",
    "holy cross voivodeship": "Świętokrzyskie",
    "swietokrzyskie province": "Świętokrzyskie",
    "swietokrzyskie region": "Świętokrzyskie",
    "swietokrzyskie voivodeship": "Świętokrzyskie",

    "warminsko mazurskie": "Warmińsko-mazurskie",
    "warmia mazury": "Warmińsko-mazurskie",
    "warmian masurian": "Warmińsko-mazurskie",
    "warmian masurian province": "Warmińsko-mazurskie",
    "warmian masurian region": "Warmińsko-mazurskie",
    "warmian masurian voivodeship": "Warmińsko-mazurskie",

    wielkopolskie: "Wielkopolskie",
    wielkopolska: "Wielkopolskie",
    "greater poland": "Wielkopolskie",
    "greater poland province": "Wielkopolskie",
    "greater poland region": "Wielkopolskie",
    "greater poland voivodeship": "Wielkopolskie",

    zachodniopomorskie: "Zachodniopomorskie",
    "pomorze zachodnie": "Zachodniopomorskie",
    "west pomerania": "Zachodniopomorskie",
    "western pomerania": "Zachodniopomorskie",
    "west pomeranian": "Zachodniopomorskie",
    "western pomeranian": "Zachodniopomorskie",
    "west pomerania province": "Zachodniopomorskie",
    "west pomerania region": "Zachodniopomorskie",
    "west pomerania voivodeship": "Zachodniopomorskie",
    "western pomerania province": "Zachodniopomorskie",
    "western pomerania region": "Zachodniopomorskie",
    "western pomerania voivodeship": "Zachodniopomorskie",
    "west pomeranian province": "Zachodniopomorskie",
    "west pomeranian region": "Zachodniopomorskie",
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
    console.error(`Błąd szukania kodu OCR ${cleanedCode}:`, exactError);
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

  if (!options.allowPrefixFallback) {
    console.warn(`Nie znaleziono dokładnej lokalizacji kodu OCR: ${cleanedCode}`);
    return null;
  }

  const prefix = cleanedCode.slice(0, 2);

  const { data: fallbackLocations, error: fallbackError } = await supabase
    .from("postal_code_locations")
    .select("postal_code, latitude, longitude, province")
    .like("postal_code", `${prefix}-%`)
    .limit(500);

  if (fallbackError) {
    console.error(`Błąd fallbacku kodu OCR ${cleanedCode}:`, fallbackError);
  }

  const targetNumber = Number(cleanedCode.replace("-", ""));
  const fallbackLocation = (fallbackLocations as PostalCodeLocation[] | null | undefined)
    ?.filter((location) => Boolean(cleanDetectedPostalCode(location.postal_code)))
    .sort((a, b) => {
      const aNumber = Number(cleanDetectedPostalCode(a.postal_code)?.replace("-", "") || "0");
      const bNumber = Number(cleanDetectedPostalCode(b.postal_code)?.replace("-", "") || "0");
      return Math.abs(aNumber - targetNumber) - Math.abs(bNumber - targetNumber);
    })[0];

  if (fallbackLocation) {
    console.warn(
      `Użyto najbliższego fallbacku lokalizacji OCR dla ${cleanedCode}: ${fallbackLocation.postal_code}`
    );
  }

  return fallbackLocation || null;
}

async function assignAdvisorByPostalCode(postalCode: string | null) {
  if (!postalCode) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const targetLocation = await findPostalCodeLocation(supabase, postalCode, {
    allowPrefixFallback: true,
  });

  if (!targetLocation) {
    console.warn(`Nie znaleziono lokalizacji kodu klienta OCR: ${postalCode}`);
    return null;
  }

  let nearestAdvisorName: string | null = null;
  let nearestDistance = Number.MAX_VALUE;

  for (const advisor of ADVISOR_POSTAL_CODES) {
    const advisorLocation = await findPostalCodeLocation(
      supabase,
      advisor.postalCode,
      { allowPrefixFallback: true }
    );

    if (!advisorLocation) {
      console.warn(
        `Nie znaleziono lokalizacji kodu doradcy OCR: ${advisor.advisorName} / ${advisor.postalCode}`
      );
      continue;
    }

    const R = 6371;
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);

    const targetLatitudeRadians = toRadians(Number(targetLocation.latitude));
    const targetLongitudeRadians = toRadians(Number(targetLocation.longitude));
    const advisorLatitudeRadians = toRadians(Number(advisorLocation.latitude));
    const advisorLongitudeRadians = toRadians(Number(advisorLocation.longitude));

    const latitudeDifference =
      advisorLatitudeRadians - targetLatitudeRadians;
    const longitudeDifference =
      advisorLongitudeRadians - targetLongitudeRadians;

    const haversineValue =
      Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
      Math.cos(targetLatitudeRadians) *
        Math.cos(advisorLatitudeRadians) *
        Math.sin(longitudeDifference / 2) *
        Math.sin(longitudeDifference / 2);

    const angularDistance =
      2 *
      Math.atan2(
        Math.sqrt(haversineValue),
        Math.sqrt(1 - haversineValue)
      );

    const distance = R * angularDistance;

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
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Jesteś rygorystycznym, precyzyjnym modułem OCR dla systemu CRM. Analizujesz wyłącznie informacje faktycznie widoczne na zdjęciu. Nie zgadujesz, nie uzupełniasz braków i nie korzystasz z danych doradców jako danych klienta. Zwracasz wyłącznie poprawny, czysty JSON bez markdown, komentarzy i dodatkowego tekstu.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                'Odczytaj dane klienta ze zdjęcia lub zrzutu ekranu z systemu spotkań. Zwróć wyłącznie JSON o dokładnie takiej strukturze: {"full_name":string|null,"phone":string|null,"email":string|null,"street":string|null,"house_number":string|null,"city":string|null,"postal_code":string|null,"ce_meeting_datetime":string|null,"import_note":string|null}.\n\n' +
                'BEZWZGLĘDNE ZASADY DLA ADRESU KLIENTA:\n' +
                '1. "street" ma zawierać wyłącznie nazwę ulicy bez numeru domu, numeru lokalu, kodu pocztowego i miasta. Jeżeli adres nie zawiera ulicy, ale zawiera samą nazwę miejscowości, wpisz tę nazwę w "street" tylko wtedy, gdy tak wynika bezpośrednio z układu adresu.\n' +
                '2. "house_number" ma zawierać wyłącznie numer domu, lokalu albo działki. Nie dodawaj nazwy ulicy, miasta ani kodu pocztowego.\n' +
                '3. "city" ma zawierać wyłącznie nazwę miejscowości lub miasta. Nie dodawaj kodu pocztowego ani ulicy.\n' +
                '4. "postal_code" ma zawierać wyłącznie kod pocztowy klienta w formacie XX-XXX. Kod musi być bezpośrednio związany z adresem zamieszkania, montażu albo spotkania klienta. KATEGORYCZNIE ZABRANIA SIĘ przepisywania kodów pocztowych przypisanych do doradców, handlowców albo użytkowników widocznych na zdjęciu, np. "Janusz 29-100", "Mateusz 91-024", "Paweł 25-015". Nie przepisuj także numerów ID systemu ani innych ciągów cyfr jako kodu pocztowego. Jeżeli nie ma pewnego kodu klienta, zwróć null.\n\n' +
                'BEZWZGLĘDNE ZASADY DLA NOTATKI import_note:\n' +
                '1. import_note jest polem kluczowym. Odczytaj wszystkie informacje techniczne, sprzedażowe, finansowe i opisowe widoczne na zdjęciu poza podstawowymi danymi klienta.\n' +
                '2. ZIGNORUJ napis "Notatka: Brak" albo podobną informację o braku notatki, jeżeli w dowolnym innym miejscu zdjęcia, również niżej na ekranie, widoczne są dane techniczne, sprzedażowe, opis spotkania, uwagi albo parametry oferty.\n' +
                '3. NIE UCINAJ, NIE STRESZCZAJ i NIE POMIJAJ widocznego tekstu. Przeczytaj całe zdjęcie od góry do dołu, również sekcje "Spotkanie handlowe", "Opis", "Uwagi", "Informacje dodatkowe" i podobne.\n' +
                '4. Połącz informacje w jednym polu import_note, oddzielając poszczególne elementy przecinkami. Zachowaj możliwie dokładne brzmienie i wartości.\n' +
                '5. import_note musi obejmować, jeżeli są widoczne: właściciela licznika, rodzaj pokrycia dachowego, wysokość rachunków, okres rachunku, taryfę lub stawki, informacje o umowie kompleksowej, produkt, informacje dodatkowe, wyceny, moce falowników, modele falowników, moc instalacji, parametry magazynu energii oraz inne dane techniczne.\n' +
                '6. Właściciel licznika zawsze trafia do import_note i nigdy nie jest tworzony jako osobne pole.\n\n' +
                'POZOSTAŁE ZASADY:\n' +
                '- "email" uzupełnij tylko wtedy, gdy jest to adres klienta. Ignoruj wszystkie adresy zawierające columbusenergy, columbusone albo columbuselite.\n' +
                '- "ce_meeting_datetime" ma zawierać widoczną datę i godzinę spotkania w CE, Columbus albo innym systemie konkurencji. Zachowaj czytelny format, np. "21.06.2026 14:30", albo dokładne brzmienie ze zdjęcia. Jeżeli nie ma daty i godziny spotkania, zwróć null.\n' +
                '- Dla każdego pola zwróć null, gdy wartości nie da się pewnie odczytać. Nie halucynuj i nie rekonstruuj danych na podstawie kontekstu.',
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "low",
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
      ce_meeting_datetime?: unknown;
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
          detectedPostalCode,
          { allowPrefixFallback: true }
        );

        detectedProvince = normalizeProvinceName(location?.province || null);
      }
    }

    // Łączymy ulicę i numer domu w jedno pole tekstowe "address", które leci do tabeli podglądu
    const streetStr = normalizeText(parsed?.street);
    const houseNumStr = normalizeText(parsed?.house_number);
    const cleanAddress = [streetStr, houseNumStr].filter(Boolean).join(" ");
    const ceMeetingDatetime = normalizeText(parsed?.ce_meeting_datetime);
    const importNote = normalizeText(parsed?.import_note);
    const finalImportNote = [
      ceMeetingDatetime ? `Data spotkania w CE: ${ceMeetingDatetime}` : null,
      importNote,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      source_file_name: file.name,
      full_name: normalizeText(parsed?.full_name),
      phone: normalizePhone(parsed?.phone),
      email: sanitizeEmail(parsed?.email),
      city: normalizeText(parsed?.city),
      address: cleanAddress || null,
      postal_code: detectedPostalCode,
      province: normalizeProvinceName(detectedProvince),
      import_note: finalImportNote || null,
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

    if (files.length > OCR_MAX_FILES) {
      return NextResponse.json(
        {
          rows: [],
          error: `Możesz zaimportować maksymalnie ${OCR_MAX_FILES} zdjęć naraz. Podziel większą paczkę na kilka importów.`,
        },
        { status: 400 }
      );
    }

    const rows = await analyzeImagesInBatches(files);

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