"use client";

import { useMemo, useState } from "react";
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

  const canImport = true;

  const validRows = useMemo(() => {
    return rows.filter((row) => row.full_name || row.company_name || row.phone || row.email);
  }, [rows]);

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
      });

      const mappedRows = parsedRows.map(mapExcelRowToClient);
      setRows(mappedRows);
    } catch (error) {
      console.error("Błąd odczytu Excela:", error);
      setErrorMessage("Nie udało się odczytać pliku Excel. Sprawdź format arkusza.");
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
            created_by: null,
          };
        })
        .filter(Boolean) as {
          client_id: string;
          content: string;
          created_by: null;
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
            Import kontaktów z Excela
          </h1>
          <p className="text-slate-500 mt-2">
            Wgraj arkusz z kolumnami: Typ, NazwaKlienta, Miejscowosc,
            Ulica_NrDomu, KodPocztowy, Email, Telefon, NIP,
            OsobaKontaktowa, TelefonKontakt, Notatka.
          </p>
        </header>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Plik Excel
            </label>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-emerald-400"
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
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold"
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