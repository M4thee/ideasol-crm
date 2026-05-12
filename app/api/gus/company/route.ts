import { NextResponse } from "next/server";

function cleanNip(nip: string) {
  return nip.replace(/\D/g, "");
}

function normalizeProvinceName(province: string | null | undefined) {
  if (!province) return "";

  const normalized = province.toLowerCase();

  const map: Record<string, string> = {
    dolnoslaskie: "Dolnośląskie",
    "kujawsko-pomorskie": "Kujawsko-Pomorskie",
    lubelskie: "Lubelskie",
    lubuskie: "Lubuskie",
    lodzkie: "Łódzkie",
    malopolskie: "Małopolskie",
    mazowieckie: "Mazowieckie",
    opolskie: "Opolskie",
    podkarpackie: "Podkarpackie",
    podlaskie: "Podlaskie",
    pomorskie: "Pomorskie",
    slaskie: "Śląskie",
    swietokrzyskie: "Świętokrzyskie",
    "warminsko-mazurskie": "Warmińsko-Mazurskie",
    wielkopolskie: "Wielkopolskie",
    zachodniopomorskie: "Zachodniopomorskie",
  };

  return map[normalized] || province;
}

function parseMfAddress(address: string | null | undefined) {
  const rawAddress = (address || "").trim();

  if (!rawAddress) {
    return {
      street: "",
      building_number: "",
      postal_code: "",
      city: "",
    };
  }

  const normalizedAddress = rawAddress.replace(/\s+/g, " ").trim();
  const postalCodeMatch = normalizedAddress.match(/\b\d{2}-\d{3}\b/);
  const postal_code = postalCodeMatch?.[0] || "";

  const parts = normalizedAddress.split(",").map((part) => part.trim()).filter(Boolean);
  const addressPart = parts[0] || normalizedAddress;
  const cityPart = postal_code
    ? normalizedAddress.split(postal_code)[1]?.replace(/,/g, "").trim() || ""
    : parts.length > 1
      ? parts[parts.length - 1]
      : "";

  const cleanedAddressPart = addressPart
    .replace(/^(ul\.|ulica|al\.|aleja|os\.|osiedle|pl\.|plac)\s+/i, "")
    .trim();

  const buildingMatch = cleanedAddressPart.match(/(.+?)\s+(\d+[a-zA-Z]?([/-]\d+[a-zA-Z]?)?)$/);

  return {
    street: buildingMatch ? buildingMatch[1].trim() : cleanedAddressPart,
    building_number: buildingMatch ? buildingMatch[2].trim() : "",
    postal_code,
    city: cityPart,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nip = cleanNip(body?.nip || "");

  if (nip.length !== 10) {
    return NextResponse.json(
      {
        error: "NIP musi mieć 10 cyfr.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    const response = await fetch(
      `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            result?.message ||
            result?.error ||
            "Błąd połączenia z API Ministerstwa Finansów.",
        },
        {
          status: response.status,
        }
      );
    }

    const subject = result?.result?.subject;

    if (!subject) {
      return NextResponse.json(
        {
          error: "Nie znaleziono firmy dla podanego NIP. Wprowadź dane ręcznie.",
        },
        {
          status: 404,
        }
      );
    }

    const address = subject.workingAddress || subject.residenceAddress || "";
    const parsedAddress = parseMfAddress(address);

    return NextResponse.json({
      company: {
        company_name: subject.name || "",
        nip: subject.nip || nip,
        regon: subject.regon || "",
        city: parsedAddress.city,
        postal_code: parsedAddress.postal_code,
        street: parsedAddress.street,
        building_number: parsedAddress.building_number,
        province: normalizeProvinceName(subject.residenceAddress || ""),
        vat_status: subject.statusVat || "",
        raw_address: address,
      },
    });
  } catch (error) {
    console.error("Błąd pobierania danych z MF:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać danych firmy.",
      },
      {
        status: 500,
      }
    );
  }
}
