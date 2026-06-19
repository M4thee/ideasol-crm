"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type ExcelClientRow = {
  Typ?: string;
  NazwaKlienta?: string;
  Miejscowosc?: string;
  Ulica_NrDomu?: string;
  KodPocztowy?: string;
  Email?: string;
  Telefon?: string | number;
  NIP?: string | number;
  OsobaKontaktowa?: string;
  TelefonKontakt?: string | number;
  Notatka?: string;
  Notatki?: string;
  Uwagi?: string;
};

type ImportPreviewRow = {
  type: string | null;
  full_name: string | null;
  company_name: string | null;
  city: string | null;
  address: string | null;
  street: string | null;
  postal_code: string | null;
  email: string | null;
  phone: string | null;
  nip: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  status: string;
  lead_source: string;
  is_lead: boolean;
  assigned_user_id: string | null;
  import_note: string | null;
};

type AdvisorOption = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type ImageImportDraftRow = {
  id: string;
  source_file_name: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  postal_code: string;
  province: string;
  import_note: string;
  assigned_user_id: string | null;
  ocr_status: "pending" | "ready" | "error";
  ocr_error: string | null;
};

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizePhone(value: unknown): string | null {
  const text = normalizeValue(value);
  if (!text) return null;

  return text.replace(/\.0$/, "");
}

function normalizePostalCode(value: unknown): string | null {
  const text = normalizeValue(value);
  if (!text) return null;

  const match = text.match(/\b\d{2}-\d{3}\b/);
  return match?.[0] || null;
}

function normalizeProvinceName(value: unknown): string {
  const text = normalizeValue(value);
  if (!text) return "";

  const normalized = text
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
    "lodz voivodeship": "Łódzkie",
    malopolskie: "Małopolskie",
    "lesser poland": "Małopolskie",
    "lesser poland voivodeship": "Małopolskie",
    mazowieckie: "Mazowieckie",
    masovian: "Mazowieckie",
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

function normalizeDuplicatePhone(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizeDuplicateText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

// --- Duplicate reporting types and helpers ---
type DuplicateMatch = {
  rowId: string;
  reason: string;
  importedLabel: string;
  matchedLabel: string;
};

function formatDuplicateLabel(row: {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  return `${row.full_name || "Brak nazwy"}, tel: ${row.phone || "brak telefonu"}, email: ${row.email || "brak emaila"}`;
}

function mapExcelRowToClient(row: ExcelClientRow): ImportPreviewRow {
  const type = normalizeValue(row.Typ);
  const name = normalizeValue(row.NazwaKlienta);
  const normalizedType = type?.toLowerCase() || "";
  const isBusiness =
    normalizedType.includes("b2b") ||
    normalizedType.includes("firma") ||
    normalizedType.includes("firmowy");

  return {
    type,
    full_name: isBusiness ? null : name,
    company_name: isBusiness ? name : null,
    city: normalizeValue(row.Miejscowosc),
    address: [
      normalizeValue(row.Ulica_NrDomu),
      [
        normalizeValue(row.KodPocztowy),
        normalizeValue(row.Miejscowosc),
      ]
        .filter(Boolean)
        .join(" "),
    ]
      .filter(Boolean)
      .join(", "),
    street: normalizeValue(row.Ulica_NrDomu),
    postal_code: normalizeValue(row.KodPocztowy),
    email: normalizeValue(row.Email),
    phone: normalizePhone(row.Telefon),
    nip: normalizePhone(row.NIP),
    contact_person: normalizeValue(row.OsobaKontaktowa),
    contact_phone: normalizePhone(row.TelefonKontakt),
    status: "Nowy lead",
    lead_source: "Import Excel",
    is_lead: true,
    assigned_user_id: null,
    import_note:
      normalizeValue(row.Notatka) ||
      normalizeValue(row.Notatki) ||
      normalizeValue(row.Uwagi),
  };
}

export default function ImportClientsPage() {
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);
  const [imageRows, setImageRows] = useState<ImageImportDraftRow[]>([]);
  const [imageFileNames, setImageFileNames] = useState<string[]>([]);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageImporting, setImageImporting] = useState(false);
  const [imageImportResult, setImageImportResult] = useState<string | null>(null);
  const [imageErrorMessage, setImageErrorMessage] = useState<string | null>(null);
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const [selectedImageRowIds, setSelectedImageRowIds] = useState<string[]>([]);
  const [bulkAdvisorId, setBulkAdvisorId] = useState("");

  const canImport = true;

  useEffect(() => {
    async function loadAdvisors() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, role")
        .eq("is_active", true)
        .eq("hidden_from_assignment", false)
        .in("role", ["seller", "manager", "owner"])
        .order("display_name", { ascending: true });

      if (error) {
        console.error("Błąd pobierania doradców:", error);
        return;
      }

      setAdvisors(data || []);
    }

    loadAdvisors();
  }, []);

  const validRows = useMemo(() => {
    return rows.filter((row) => row.full_name || row.company_name || row.phone || row.email);
  }, [rows]);

  const validImageRows = useMemo(() => {
    return imageRows.filter((row) => row.full_name || row.phone || row.address || row.city);
  }, [imageRows]);

  const allImageRowsSelected = useMemo(() => {
    return imageRows.length > 0 && selectedImageRowIds.length === imageRows.length;
  }, [imageRows.length, selectedImageRowIds.length]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setRows([]);
    setImportResult(null);
    setErrorMessage(null);

    if (!file) return;

    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const parsedRows = XLSX.utils.sheet_to_json<ExcelClientRow>(worksheet, {
        defval: "",
        range: 4,
      });

      const mappedRows = parsedRows.map(mapExcelRowToClient);
      setRows(mappedRows);
    } catch (error) {
      console.error("Błąd odczytu Excela:", error);
      setErrorMessage("Nie udało się odczytać pliku Excel. Sprawdź format arkusza.");
    }
  }

  function updateImageRow(
    rowId: string,
    field: keyof ImageImportDraftRow,
    value: string | null
  ) {
    setImageRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function toggleImageRowSelection(rowId: string) {
    setSelectedImageRowIds((currentIds) =>
      currentIds.includes(rowId)
        ? currentIds.filter((id) => id !== rowId)
        : [...currentIds, rowId]
    );
  }

  function toggleAllImageRowsSelection() {
    setSelectedImageRowIds((currentIds) => {
      if (currentIds.length === imageRows.length) return [];
      return imageRows.map((row) => row.id);
    });
  }

  function assignSelectedImageRowsToAdvisor() {
    if (selectedImageRowIds.length === 0) {
      alert("Zaznacz leady, które chcesz przypisać do doradcy.");
      return;
    }

    setImageRows((currentRows) =>
      currentRows.map((row) =>
        selectedImageRowIds.includes(row.id)
          ? {
              ...row,
              assigned_user_id: bulkAdvisorId || null,
            }
          : row
      )
    );
  }

  function deleteSelectedImageRows() {
    if (selectedImageRowIds.length === 0) {
      alert("Zaznacz wiersze, które chcesz usunąć.");
      return;
    }

    setImageRows((currentRows) =>
      currentRows.filter((row) => !selectedImageRowIds.includes(row.id))
    );
    setSelectedImageRowIds([]);
  }

  async function findDuplicateImageRows() {
    const duplicateRowIds = new Set<string>();
    const duplicateMatches: DuplicateMatch[] = [];
    const seenPhones = new Map<string, ImageImportDraftRow>();
    const seenEmails = new Map<string, ImageImportDraftRow>();
    const seenNames = new Map<string, ImageImportDraftRow>();

    function addDuplicateMatch(match: DuplicateMatch) {
      const key = `${match.rowId}|${match.reason}|${match.importedLabel}|${match.matchedLabel}`;
      const alreadyExists = duplicateMatches.some(
        (existingMatch) =>
          `${existingMatch.rowId}|${existingMatch.reason}|${existingMatch.importedLabel}|${existingMatch.matchedLabel}` === key
      );

      if (!alreadyExists) {
        duplicateMatches.push(match);
      }
    }

    for (const row of validImageRows) {
      const phone = normalizeDuplicatePhone(row.phone);
      const email = normalizeDuplicateText(row.email);
      const name = normalizeDuplicateText(row.full_name);

      if (phone) {
        const existingRow = seenPhones.get(phone);
        if (existingRow) {
          duplicateRowIds.add(row.id);
          addDuplicateMatch({
            rowId: row.id,
            reason: `Ten sam telefon: ${row.phone}`,
            importedLabel: formatDuplicateLabel(row),
            matchedLabel: formatDuplicateLabel(existingRow),
          });
        } else {
          seenPhones.set(phone, row);
        }
      }

      if (email) {
        const existingRow = seenEmails.get(email);
        if (existingRow) {
          duplicateRowIds.add(row.id);
          addDuplicateMatch({
            rowId: row.id,
            reason: `Ten sam email: ${row.email}`,
            importedLabel: formatDuplicateLabel(row),
            matchedLabel: formatDuplicateLabel(existingRow),
          });
        } else {
          seenEmails.set(email, row);
        }
      }

      if (name) {
        const existingRow = seenNames.get(name);
        if (existingRow) {
          duplicateRowIds.add(row.id);
          addDuplicateMatch({
            rowId: row.id,
            reason: `To samo imię i nazwisko: ${row.full_name}`,
            importedLabel: formatDuplicateLabel(row),
            matchedLabel: formatDuplicateLabel(existingRow),
          });
        } else {
          seenNames.set(name, row);
        }
      }
    }

    const phones = uniqueStrings(
      validImageRows.map((row) => normalizeDuplicatePhone(row.phone))
    );
    const emails = uniqueStrings(
      validImageRows.map((row) => normalizeDuplicateText(row.email))
    );
    const names = uniqueStrings(
      validImageRows.map((row) => normalizeDuplicateText(row.full_name))
    );

    if (phones.length > 0) {
      const { data, error } = await supabase
        .from("clients")
        .select("full_name, phone, email")
        .in("phone", phones);

      if (error) {
        console.error("Błąd sprawdzania duplikatów po telefonie:", error);
      }

      const existingClientsByPhone = new Map(
        (data || []).map((client) => [
          normalizeDuplicatePhone(client.phone),
          client,
        ])
      );

      validImageRows.forEach((row) => {
        const existingClient = existingClientsByPhone.get(
          normalizeDuplicatePhone(row.phone)
        );

        if (existingClient) {
          duplicateRowIds.add(row.id);
          addDuplicateMatch({
            rowId: row.id,
            reason: `Ten sam telefon w CRM: ${row.phone}`,
            importedLabel: formatDuplicateLabel(row),
            matchedLabel: formatDuplicateLabel(existingClient),
          });
        }
      });
    }

    if (emails.length > 0) {
      const { data, error } = await supabase
        .from("clients")
        .select("full_name, phone, email")
        .in("email", emails);

      if (error) {
        console.error("Błąd sprawdzania duplikatów po emailu:", error);
      }

      const existingClientsByEmail = new Map(
        (data || []).map((client) => [
          normalizeDuplicateText(client.email),
          client,
        ])
      );

      validImageRows.forEach((row) => {
        const existingClient = existingClientsByEmail.get(
          normalizeDuplicateText(row.email)
        );

        if (existingClient) {
          duplicateRowIds.add(row.id);
          addDuplicateMatch({
            rowId: row.id,
            reason: `Ten sam email w CRM: ${row.email}`,
            importedLabel: formatDuplicateLabel(row),
            matchedLabel: formatDuplicateLabel(existingClient),
          });
        }
      });
    }

    if (names.length > 0) {
      const { data, error } = await supabase
        .from("clients")
        .select("full_name, phone, email")
        .in("full_name", names);

      if (error) {
        console.error("Błąd sprawdzania duplikatów po nazwie:", error);
      }

      const existingClientsByName = new Map(
        (data || []).map((client) => [
          normalizeDuplicateText(client.full_name),
          client,
        ])
      );

      validImageRows.forEach((row) => {
        const existingClient = existingClientsByName.get(
          normalizeDuplicateText(row.full_name)
        );

        if (existingClient) {
          duplicateRowIds.add(row.id);
          addDuplicateMatch({
            rowId: row.id,
            reason: `To samo imię i nazwisko w CRM: ${row.full_name}`,
            importedLabel: formatDuplicateLabel(row),
            matchedLabel: formatDuplicateLabel(existingClient),
          });
        }
      });
    }

    return {
      duplicateRowIds: Array.from(duplicateRowIds),
      duplicateMatches,
    };
  }

  function createEmptyImageDraftRow(file: File, index: number): ImageImportDraftRow {
    return {
      id: `${Date.now()}-${index}-${file.name}`,
      source_file_name: file.name,
      full_name: "",
      phone: "",
      email: "",
      city: "",
      address: "",
      postal_code: "",
      province: "",
      import_note: "",
      assigned_user_id: null,
      ocr_status: "pending",
      ocr_error: null,
    };
  }

  async function processImageFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    setImageRows([]);
    setImageFileNames([]);
    setSelectedImageRowIds([]);
    setBulkAdvisorId("");
    setImageImportResult(null);
    setImageErrorMessage(null);

    if (imageFiles.length === 0) {
      setImageErrorMessage("Wrzuć plik graficzny, np. JPG, PNG albo WEBP.");
      return;
    }

    setImageProcessing(true);
    setImageFileNames(imageFiles.map((file) => file.name));

    try {
      const formData = new FormData();
      imageFiles.forEach((file) => formData.append("images", file));

      const response = await fetch("/api/clients/import-images", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Nie udało się odczytać danych ze zdjęć.");
      }

      const result = (await response.json()) as {
        rows?: Array<{
          source_file_name?: string;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          address?: string | null;
          postal_code?: string | null;
          province?: string | null;
          import_note?: string | null;
          assigned_user_id?: string | null;
          error?: string | null;
        }>;
      };

      const mappedRows = imageFiles.map((file, index) => {
        const resultRow = result.rows?.find(
          (row) => row.source_file_name === file.name
        );

        return {
          ...createEmptyImageDraftRow(file, index),
          full_name: resultRow?.full_name || "",
          phone: normalizePhone(resultRow?.phone) || "",
          email: resultRow?.email || "",
          city: resultRow?.city || "",
          address: resultRow?.address || "",
          postal_code:
            resultRow?.postal_code || normalizePostalCode(resultRow?.address) || "",
          province: normalizeProvinceName(resultRow?.province),
          import_note: resultRow?.import_note || "",
          assigned_user_id: resultRow?.assigned_user_id || null,
          ocr_status: resultRow?.error ? "error" : "ready",
          ocr_error: resultRow?.error || null,
        } satisfies ImageImportDraftRow;
      });

      setImageRows(mappedRows);
    } catch (error) {
      console.error("Błąd OCR/importu zdjęć:", error);
      setImageErrorMessage(
        "Nie udało się automatycznie odczytać zdjęć. Tabela została przygotowana do ręcznego uzupełnienia."
      );
      setImageRows(imageFiles.map(createEmptyImageDraftRow));
    } finally {
      setImageProcessing(false);
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    await processImageFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  async function handleImageDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingImages(false);
    await processImageFiles(Array.from(event.dataTransfer.files || []));
  }

  async function importImageClients(skipDuplicateCheck = false) {
    if (!canImport) {
      alert("Tylko administrator może importować kontakty.");
      return;
    }

    if (validImageRows.length === 0) {
      alert("Brak poprawnych rekordów do importu.");
      return;
    }

    if (!skipDuplicateCheck) {
      const { duplicateRowIds, duplicateMatches } = await findDuplicateImageRows();

      if (duplicateRowIds.length > 0) {
        const duplicateDetails = duplicateMatches
          .slice(0, 10)
          .map(
            (match, index) =>
              `${index + 1}. ${match.reason}\nImportowany: ${match.importedLabel}\nPasujący: ${match.matchedLabel}`
          )
          .join("\n\n");

        const importAnyway = window.confirm(
          `Wykryto potencjalne duble importowanych klientów lub wybrani klienci już istnieją w systemie:\n\n${duplicateDetails}${
            duplicateMatches.length > 10 ? "\n\n..." : ""
          }\n\nNaciśnij OK, aby zignorować ostrzeżenie lub Anuluj, aby usunąć zdublowane wpisy i kontynuować z pozostałymi.`
        );

        if (!importAnyway) {
          setImageRows((currentRows) =>
            currentRows.filter((row) => !duplicateRowIds.includes(row.id))
          );
          setSelectedImageRowIds([]);
          setImageErrorMessage(
            `Usunięto ${duplicateRowIds.length} powtórzonych wierszy z podglądu OCR. Pierwsze wpisy zostały zachowane.`
          );
          return;
        }
      }
    }

    try {
      setImageImporting(true);
      setImageImportResult(null);
      setImageErrorMessage(null);

      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUserId = currentUserData.user?.id || null;

      const rowsToInsert = validImageRows.map((row) => ({
        full_name: row.full_name || null,
        company_name: null,
        city: row.city || null,
        address: row.address || null,
        street: row.address || null,
        postal_code: row.postal_code || normalizePostalCode(row.address),
        province: normalizeProvinceName(row.province) || null,
        email: row.email || null,
        phone: normalizePhone(row.phone),
        nip: null,
        contact_person: null,
        contact_phone: null,
        status: row.assigned_user_id ? "Przypisany" : "Nowy lead",
        lead_source: "Import ze zdjęcia",
        is_lead: true,
        assigned_user_id: row.assigned_user_id,
      }));

      const { data: insertedClients, error } = await supabase
        .from("clients")
        .insert(rowsToInsert)
        .select("id, full_name, phone, email");

      if (error) {
        console.error("Błąd importu klientów ze zdjęć:", error);
        setImageErrorMessage(error.message || "Nie udało się zaimportować klientów.");
        return;
      }

      const insertedClientsByPhone = new Map(
        (insertedClients || []).map((client) => [
          normalizeDuplicatePhone(client.phone),
          client.id,
        ])
      );

      const insertedClientsByEmail = new Map(
        (insertedClients || []).map((client) => [
          normalizeDuplicateText(client.email),
          client.id,
        ])
      );

      const insertedClientsByName = new Map(
        (insertedClients || []).map((client) => [
          normalizeDuplicateText(client.full_name),
          client.id,
        ])
      );

      const notesToInsert = validImageRows
        .map((row, index) => {
          const clientId =
            insertedClientsByPhone.get(normalizeDuplicatePhone(row.phone)) ||
            insertedClientsByEmail.get(normalizeDuplicateText(row.email)) ||
            insertedClientsByName.get(normalizeDuplicateText(row.full_name)) ||
            insertedClients?.[index]?.id;

          const noteContent = row.import_note?.trim();

          if (!clientId || !noteContent) {
            return null;
          }

          return {
            client_id: clientId,
            content: `[IMPORT OCR]\n${noteContent}`,
            created_by: currentUserId,
          };
        })
        .filter(Boolean) as {
          client_id: string;
          content: string;
          created_by: string | null;
        }[];

      if (notesToInsert.length > 0) {
        const { error: notesError } = await supabase
          .from("client_notes")
          .insert(notesToInsert);

        if (notesError) {
          console.error(
            "Leady ze zdjęć zaimportowane, ale nie udało się zapisać notatek:",
            notesError
          );

          setImageErrorMessage(
            `Zaimportowano ${validImageRows.length} leadów ze zdjęć, ale nie udało się zapisać notatek OCR: ${notesError.message}`
          );

          return;
        }

        console.log("OCR notes inserted:", notesToInsert.length, notesToInsert);
      }

      if (validImageRows.some((row) => row.import_note?.trim()) && notesToInsert.length === 0) {
        console.warn("OCR rozpoznał notatki, ale nie przygotowano żadnej notatki do zapisu.", {
          validImageRows,
          insertedClients,
        });
        setImageErrorMessage(
          "Leady zostały zaimportowane, ale notatki OCR nie zostały zapisane, bo nie udało się powiązać ich z nowymi klientami."
        );
      }

      const { data: existingOcrTag, error: existingOcrTagError } = await supabase
        .from("client_tags")
        .select("id")
        .ilike("name", "OCR")
        .maybeSingle();

      if (existingOcrTagError) {
        console.error("Nie udało się sprawdzić tagu OCR:", existingOcrTagError);
      }

      let ocrTagId = existingOcrTag?.id || null;

      if (ocrTagId) {
        const { error: updateOcrTagColorError } = await supabase
          .from("client_tags")
          .update({ color: "#FF6E0E" })
          .eq("id", ocrTagId);

        if (updateOcrTagColorError) {
          console.error(
            "Nie udało się zaktualizować koloru tagu OCR:",
            updateOcrTagColorError
          );
        }
      }

      if (!ocrTagId) {
        const { data: createdOcrTag, error: createdOcrTagError } = await supabase
          .from("client_tags")
          .insert({
            name: "OCR",
            color: "#FF6E0E",
          })
          .select("id")
          .single();

        if (createdOcrTagError) {
          console.error("Nie udało się utworzyć tagu OCR:", createdOcrTagError);
          setImageErrorMessage(
            `Leady zaimportowane, ale nie udało się utworzyć tagu OCR: ${createdOcrTagError.message}`
          );
        } else {
          ocrTagId = createdOcrTag?.id || null;
        }
      }

      if (ocrTagId && insertedClients && insertedClients.length > 0) {
        const tagLinksToInsert = insertedClients.map((client) => ({
          client_id: client.id,
          tag_id: ocrTagId,
          created_by: currentUserId,
        }));

        const { error: tagLinksError } = await supabase
          .from("client_tag_links")
          .insert(tagLinksToInsert);

        if (tagLinksError) {
          console.error("Nie udało się przypisać tagu OCR:", tagLinksError);
          setImageErrorMessage(
            `Leady zaimportowane, ale nie udało się przypisać tagu OCR: ${tagLinksError.message}`
          );
        }
      }

      setImageImportResult(
        `Zaimportowano ${validImageRows.length} leadów ze zdjęć do CRM. Notatki OCR: ${notesToInsert.length}. Tag: OCR.`
      );
      setImageRows([]);
      setImageFileNames([]);
      setSelectedImageRowIds([]);
      setBulkAdvisorId("");
    } catch (error) {
      console.error("Nieoczekiwany błąd importu zdjęć:", error);
      setImageErrorMessage("Wystąpił nieoczekiwany błąd podczas importu zdjęć.");
    } finally {
      setImageImporting(false);
    }
  }

  async function importClients() {
    if (!canImport) {
      alert("Tylko administrator może importować kontakty.");
      return;
    }

    if (validRows.length === 0) {
      alert("Brak poprawnych rekordów do importu.");
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);
      setErrorMessage(null);

      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUserId = currentUserData.user?.id || null;

      const rowsToInsert = validRows.map(
        ({ type, import_note, ...clientRow }) => clientRow
      );

      const { data: insertedClients, error } = await supabase
        .from("clients")
        .insert(rowsToInsert)
        .select("id");

      if (error) {
        console.error("Błąd importu klientów:", error);
        setErrorMessage(error.message || "Nie udało się zaimportować klientów.");
        return;
      }

      const notesToInsert = validRows
        .map((row, index) => {
          const clientId = insertedClients?.[index]?.id;

          if (!clientId || !row.import_note) {
            return null;
          }

          return {
            client_id: clientId,
            content: row.import_note,
            created_by: currentUserId,
          };
        })
        .filter(Boolean) as {
          client_id: string;
          content: string;
          created_by: string | null;
        }[];

      if (notesToInsert.length > 0) {
        const { error: notesError } = await supabase
          .from("client_notes")
          .insert(notesToInsert);

        if (notesError) {
          console.error(
            "Leady zaimportowane, ale nie udało się zapisać notatek:",
            notesError
          );

          setErrorMessage(
            `Zaimportowano ${validRows.length} leadów, ale nie udało się zapisać notatek: ${notesError.message}`
          );

          return;
        }
      }

      setImportResult(
        `Zaimportowano ${validRows.length} leadów do CRM. Notatki: ${notesToInsert.length}.`
      );
      setRows([]);
      setFileName(null);
    } catch (error) {
      console.error("Nieoczekiwany błąd importu:", error);
      setErrorMessage("Wystąpił nieoczekiwany błąd podczas importu.");
    } finally {
      setImporting(false);
    }
  }

  if (!canImport) {
    return (
      <main className="text-slate-900">
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-900">Brak dostępu</h1>
          <p className="text-slate-500 mt-2">
            Import kontaktów z Excela jest dostępny tylko dla administratora.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="text-slate-900">
      <div className="space-y-6">
        <header>
          <p className="text-sm text-slate-500 mb-1">Import leadów</p>
          <h1 className="text-3xl font-bold text-slate-900">
            Import kontaktów
          </h1>
          <p className="text-slate-500 mt-2">
            Wgraj kontakty z arkusza Excel albo dodaj leady ze zdjęć i screenów
            spotkań. Przed zapisem możesz sprawdzić i poprawić dane w tabeli.
          </p>
        </header>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Import z Excela</h2>
              <p className="text-sm text-slate-500 mt-1">
                Wgraj arkusz z kolumnami: Typ, NazwaKlienta, Miejscowosc,
                Ulica_NrDomu, KodPocztowy, Email, Telefon, NIP,
                OsobaKontaktowa, TelefonKontakt, Notatka.
              </p>
            </div>

            <a
              href="/templates/import-klientow.xlsx"
              download
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition duration-150 hover:-translate-y-0.5 hover:border-[#73C7BA] hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              Pobierz szablon Excel
            </a>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Plik Excel
            </label>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="block w-full cursor-pointer text-sm text-slate-700 file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-bold file:text-white file:transition file:duration-150 hover:file:-translate-y-0.5 hover:file:bg-emerald-400 hover:file:shadow-md active:file:translate-y-0 active:file:scale-[0.98]"
            />
          </div>

          {fileName && (
            <p className="text-sm text-slate-500">
              Wybrany plik: <span className="font-semibold">{fileName}</span>
            </p>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {importResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {importResult}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Import ze zdjęć i screenów spotkań
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Wgraj jedno lub kilka zdjęć. System odczyta klienta, telefon,
              adres, miasto i notatkę, a potem pokaże dane do ręcznej korekty.
            </p>
          </div>


          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Zdjęcia / screeny
            </label>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingImages(true);
              }}
              onDragLeave={() => setIsDraggingImages(false)}
              onDrop={handleImageDrop}
              className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] ${
                isDraggingImages
                  ? "border-[#73C7BA] bg-[#73C7BA]/20 shadow-md"
                  : "border-slate-300 bg-slate-50 hover:border-[#73C7BA] hover:bg-[#73C7BA]/10"
              }`}
            >
              <div className="text-base font-bold text-slate-900">
                Przeciągnij i upuść zdjęcia tutaj
              </div>
              <div className="mt-1 text-sm text-slate-500">
                albo kliknij, żeby wybrać pliki z komputera
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Obsługiwane: JPG, PNG, WEBP. Możesz dodać kilka zdjęć naraz.
              </div>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {imageFileNames.length > 0 && (
            <p className="text-sm text-slate-500">
              Wybrane pliki: {imageFileNames.join(", ")}
            </p>
          )}

          {imageProcessing && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Odczytuję dane ze zdjęć...
            </div>
          )}

          {imageErrorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {imageErrorMessage}
            </div>
          )}

          {imageImportResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {imageImportResult}
            </div>
          )}
        </section>

        {imageRows.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Podgląd importu ze zdjęć
                  </h2>
                  <p className="text-sm text-slate-500">
                    Do importu trafi {validImageRows.length} z {imageRows.length} rekordów.
                    Zaznaczone: {selectedImageRowIds.length}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => importImageClients()}
                  disabled={imageImporting || validImageRows.length === 0}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-[#73C7BA] text-slate-950 font-bold transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:shadow-none disabled:opacity-50"
                >
                  {imageImporting ? "Importowanie..." : "Zaimportuj leady ze zdjęć"}
                </button>
              </div>

              <div className="flex items-end gap-3 flex-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                    Masowe przypisanie doradcy
                  </label>
                  <select
                    value={bulkAdvisorId}
                    onChange={(event) => setBulkAdvisorId(event.target.value)}
                    className="min-w-[260px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition duration-150 hover:border-[#73C7BA] hover:shadow-sm focus:border-[#73C7BA]"
                  >
                    <option value="">Nieprzypisany</option>
                    {advisors.map((advisor) => (
                      <option key={advisor.id} value={advisor.id}>
                        {advisor.display_name || advisor.email || advisor.id}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={assignSelectedImageRowsToAdvisor}
                  disabled={selectedImageRowIds.length === 0}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-slate-900 text-white font-bold transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:shadow-none disabled:opacity-50"
                >
                  Przypisz zaznaczonych
                </button>

                <button
                  type="button"
                  onClick={deleteSelectedImageRows}
                  disabled={selectedImageRowIds.length === 0}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-red-700 text-white font-bold transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:shadow-none disabled:opacity-50"
                >
                  Usuń zaznaczone
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedImageRowIds([])}
                  disabled={selectedImageRowIds.length === 0}
                  className="cursor-pointer px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:bg-slate-50 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:shadow-none disabled:opacity-50"
                >
                  Odznacz
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold w-[56px]">
                      <input
                        type="checkbox"
                        checked={allImageRowsSelected}
                        onChange={toggleAllImageRowsSelection}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 transition duration-150 hover:scale-110 active:scale-95"
                        aria-label="Zaznacz wszystkie rekordy OCR"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">Plik</th>
                    <th className="text-left px-4 py-3 font-semibold">Klient</th>
                    <th className="text-left px-4 py-3 font-semibold">Telefon</th>
                    <th className="text-left px-4 py-3 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 font-semibold">Miasto</th>
                    <th className="text-left px-4 py-3 font-semibold">Adres</th>
                    <th className="text-left px-4 py-3 font-semibold">Kod</th>
                    <th className="text-left px-4 py-3 font-semibold">Województwo</th>
                    <th className="text-left px-4 py-3 font-semibold">Doradca</th>
                    <th className="text-left px-4 py-3 font-semibold">Notatka</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {imageRows.map((row) => (
                    <tr key={row.id} className={row.ocr_status === "error" ? "bg-red-50" : ""}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedImageRowIds.includes(row.id)}
                          onChange={() => toggleImageRowSelection(row.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 transition duration-150 hover:scale-110 active:scale-95"
                          aria-label={`Zaznacz ${row.full_name || row.source_file_name}`}
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[180px] align-top">
                        <div className="font-semibold text-slate-800">{row.source_file_name}</div>
                        {row.ocr_error && (
                          <div className="text-xs text-red-600 mt-1">{row.ocr_error}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 min-w-[220px] align-top">
                        <input
                          value={row.full_name}
                          onChange={(event) =>
                            updateImageRow(row.id, "full_name", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="Imię i nazwisko"
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[150px] align-top">
                        <input
                          value={row.phone}
                          onChange={(event) =>
                            updateImageRow(row.id, "phone", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="Telefon"
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[220px] align-top">
                        <input
                          value={row.email}
                          onChange={(event) =>
                            updateImageRow(row.id, "email", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="Email"
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[180px] align-top">
                        <input
                          value={row.city}
                          onChange={(event) =>
                            updateImageRow(row.id, "city", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="Miasto"
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[260px] align-top">
                        <input
                          value={row.address}
                          onChange={(event) =>
                            updateImageRow(row.id, "address", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="Adres"
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[120px] align-top">
                        <input
                          value={row.postal_code}
                          onChange={(event) =>
                            updateImageRow(row.id, "postal_code", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="00-000"
                        />
                      </td>
                      <td className="px-4 py-3 min-w-[180px] align-top">
                        <input
                          value={row.province}
                          onChange={(event) =>
                            updateImageRow(
                              row.id,
                              "province",
                              normalizeProvinceName(event.target.value)
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="Województwo"
                        />
                      </td>

                      <td className="px-4 py-3 min-w-[220px] align-top">
                        <select
                          value={row.assigned_user_id || ""}
                          onChange={(event) =>
                            updateImageRow(
                              row.id,
                              "assigned_user_id",
                              event.target.value || null
                            )
                          }
                          className="w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition duration-150 hover:border-[#73C7BA] hover:shadow-sm focus:border-[#73C7BA]"
                        >
                          <option value="">Nieprzypisany</option>
                          {advisors.map((advisor) => (
                            <option key={advisor.id} value={advisor.id}>
                              {advisor.display_name || advisor.email || advisor.id}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 min-w-[320px] align-top">
                        <textarea
                          value={row.import_note}
                          onChange={(event) =>
                            updateImageRow(row.id, "import_note", event.target.value)
                          }
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#73C7BA]"
                          placeholder="Notatka ze spotkania / screena"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {rows.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Podgląd importu
                </h2>
                <p className="text-sm text-slate-500">
                  Do importu trafi {validRows.length} z {rows.length} wierszy.
                </p>
              </div>

              <button
                type="button"
                onClick={importClients}
                disabled={importing || validRows.length === 0}
                className="cursor-pointer px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold transition duration-150 hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:shadow-none disabled:opacity-50"
              >
                {importing ? "Importowanie..." : "Zaimportuj leady"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">Typ</th>
                    <th className="text-left px-6 py-3 font-semibold">Nazwa</th>
                    <th className="text-left px-6 py-3 font-semibold">Miasto</th>
                    <th className="text-left px-6 py-3 font-semibold">Adres</th>
                    <th className="text-left px-6 py-3 font-semibold">Telefon</th>
                    <th className="text-left px-6 py-3 font-semibold">Email</th>
                    <th className="text-left px-6 py-3 font-semibold">NIP</th>
                    <th className="text-left px-6 py-3 font-semibold">Kontakt</th>
                    <th className="text-left px-6 py-3 font-semibold">Notatka</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 50).map((row, index) => (
                    <tr key={`${row.phone}-${row.email}-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap">{row.type || "—"}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                        {row.full_name || row.company_name || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.city || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.address || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.phone || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.email || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.nip || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {row.contact_person || row.contact_phone || "—"}
                      </td>
                      <td className="px-6 py-4 min-w-[240px] max-w-[360px] whitespace-normal">
                        {row.import_note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 50 && (
              <p className="p-4 text-sm text-slate-500 border-t border-slate-200">
                Pokazano pierwsze 50 wierszy z {rows.length}.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}