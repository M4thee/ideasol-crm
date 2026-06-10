import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const CSV_PATH = path.join(ROOT_DIR, "imports", "postal-codes", "zipcodes.pl.csv");
const BATCH_SIZE = 1000;

function loadEnvFile(fileName) {
  const filePath = path.join(ROOT_DIR, fileName);

  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Brakuje NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w .env.local.");
  process.exit(1);
}

if (!fs.existsSync(CSV_PATH)) {
  console.error(`Nie znaleziono pliku CSV: ${CSV_PATH}`);
  console.error("Wrzuc plik jako: imports/postal-codes/zipcodes.pl.csv");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const provinceMap = new Map([
  ["Lower Silesia", "Dolnośląskie"],
  ["Kuyavian-Pomeranian", "Kujawsko-pomorskie"],
  ["Lublin", "Lubelskie"],
  ["Lubusz", "Lubuskie"],
  ["Lodz", "Łódzkie"],
  ["Łódź", "Łódzkie"],
  ["Lesser Poland", "Małopolskie"],
  ["Masovian", "Mazowieckie"],
  ["Opole", "Opolskie"],
  ["Subcarpathian", "Podkarpackie"],
  ["Podlaskie", "Podlaskie"],
  ["Pomeranian", "Pomorskie"],
  ["Silesian", "Śląskie"],
  ["Silesia", "Śląskie"],
  ["Swietokrzyskie", "Świętokrzyskie"],
  ["Świętokrzyskie", "Świętokrzyskie"],
  ["Warmian-Masurian", "Warmińsko-mazurskie"],
  ["Greater Poland", "Wielkopolskie"],
  ["West Pomeranian", "Zachodniopomorskie"],
  ["Dolnoslaskie", "Dolnośląskie"],
  ["Kujawsko-Pomorskie", "Kujawsko-pomorskie"],
  ["Lubelskie", "Lubelskie"],
  ["Lubuskie", "Lubuskie"],
  ["Lodzkie", "Łódzkie"],
  ["Malopolskie", "Małopolskie"],
  ["Mazowieckie", "Mazowieckie"],
  ["Opolskie", "Opolskie"],
  ["Podkarpackie", "Podkarpackie"],
  ["Pomorskie", "Pomorskie"],
  ["Slaskie", "Śląskie"],
  ["Warminsko-Mazurskie", "Warmińsko-mazurskie"],
  ["Wielkopolskie", "Wielkopolskie"],
  ["Zachodniopomorskie", "Zachodniopomorskie"],
]);

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      row.push(value);
      value = "";

      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    value += char;
  }

  row.push(value);

  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return value.trim().toLowerCase();
}

function getCell(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function normalizePostalCode(value) {
  const digits = value.replace(/\D/g, "").slice(0, 5);

  if (digits.length !== 5) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function translateProvince(value) {
  const trimmed = value.trim();

  if (!trimmed) return null;

  return provinceMap.get(trimmed) || provinceMap.get(trimmed.replace(/ł/g, "l").replace(/Ł/g, "L")) || trimmed;
}

function toNumberOrNull(value) {
  if (!value) return null;

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRegionRecords(rows) {
  const [headers, ...dataRows] = rows;
  const normalizedHeaders = headers.map(normalizeHeader);
  const byPostalCode = new Map();

  for (const row of dataRows) {
    const record = Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, row[index]?.trim() ?? ""])
    );

    const postalCode = normalizePostalCode(getCell(record, ["zipcode", "zip", "postal_code", "kod", "kod pocztowy"]));
    if (!postalCode) continue;

    const city = getCell(record, ["place", "city", "miejscowosc", "miejscowość"]);
    const province = translateProvince(getCell(record, ["state", "wojewodztwo", "województwo"]));
    const county = getCell(record, ["province", "county", "powiat"]);
    const municipality = getCell(record, ["community", "commune", "gmina"]);
    const latitude = toNumberOrNull(getCell(record, ["latitude", "lat", "szerokosc", "szerokość"]));
    const longitude = toNumberOrNull(getCell(record, ["longitude", "lng", "lon", "dlugosc", "długość"]));

    const existing = byPostalCode.get(postalCode);

    if (!existing) {
      byPostalCode.set(postalCode, {
        postal_code: postalCode,
        province,
        city: city || null,
        county: county || null,
        municipality: municipality || null,
        latitude,
        longitude,
      });
      continue;
    }

    if (!existing.province && province) existing.province = province;
    if (!existing.city && city) existing.city = city;
    if (!existing.county && county) existing.county = county;
    if (!existing.municipality && municipality) existing.municipality = municipality;
    if (existing.latitude === null && latitude !== null) existing.latitude = latitude;
    if (existing.longitude === null && longitude !== null) existing.longitude = longitude;
  }

  return Array.from(byPostalCode.values()).filter((record) => record.province);
}

function buildLocationRecords(rows) {
  const [headers, ...dataRows] = rows;
  const normalizedHeaders = headers.map(normalizeHeader);

  return dataRows
    .map((row) => {
      const record = Object.fromEntries(
        normalizedHeaders.map((header, index) => [header, row[index]?.trim() ?? ""])
      );

      const postalCode = normalizePostalCode(
        getCell(record, ["zipcode", "zip", "postal_code", "kod", "kod pocztowy"])
      );

      if (!postalCode) {
        return null;
      }

      return {
        postal_code: postalCode,
        city: getCell(record, ["place", "city", "miejscowosc", "miejscowość"]) || null,
        province: translateProvince(
          getCell(record, ["state", "wojewodztwo", "województwo"])
        ),
        county: getCell(record, ["province", "county", "powiat"]) || null,
        commune: getCell(record, ["community", "commune", "gmina"]) || null,
        latitude: toNumberOrNull(
          getCell(record, ["latitude", "lat", "szerokosc", "szerokość"])
        ),
        longitude: toNumberOrNull(
          getCell(record, ["longitude", "lng", "lon", "dlugosc", "długość"])
        ),
      };
    })
    .filter(Boolean);
}

async function upsertRegionRecords(records) {
  let imported = 0;

  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    const batch = records.slice(index, index + BATCH_SIZE);

    const { error } = await supabase
      .from("postal_code_regions")
      .upsert(batch, { onConflict: "postal_code" });

    if (error) {
      console.error("Błąd importu batcha:", {
        from: index,
        to: index + batch.length,
        message: error.message,
        details: error.details,
      });
      process.exit(1);
    }

    imported += batch.length;
    console.log(`Zaimportowano ${imported}/${records.length}`);
  }
}

async function upsertLocationRecords(records) {
  let imported = 0;

  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    const batch = records.slice(index, index + BATCH_SIZE);

    const { error } = await supabase
      .from("postal_code_locations")
      .insert(batch);

    if (error) {
      console.error("Błąd importu lokalizacji:", {
        from: index,
        to: index + batch.length,
        message: error.message,
        details: error.details,
      });
      process.exit(1);
    }

    imported += batch.length;
    console.log(`Lokalizacje: ${imported}/${records.length}`);
  }
}

async function main() {
  console.log(`Czytam plik: ${CSV_PATH}`);
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(content);

  if (rows.length < 2) {
    console.error("CSV jest pusty albo ma niepoprawny format.");
    process.exit(1);
  }

  const regionRecords = buildRegionRecords(rows);
  const locationRecords = buildLocationRecords(rows);

  console.log(`Wiersze CSV: ${rows.length - 1}`);
  console.log(`Unikalne kody do importu: ${regionRecords.length}`);
  console.log(`Pełne lokalizacje do importu: ${locationRecords.length}`);

  if (regionRecords.length === 0) {
    console.error("Nie znaleziono poprawnych rekordów do importu.");
    process.exit(1);
  }

  await upsertRegionRecords(regionRecords);
  await upsertLocationRecords(locationRecords);
  console.log("Import kodów pocztowych zakończony.");
}

main().catch((error) => {
  console.error("Import przerwany:", error);
  process.exit(1);
});