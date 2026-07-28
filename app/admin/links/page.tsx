"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const SHORT_LINK_BASE_URL = "https://ideasol.pl";

type ShortLink = {
  id: string;
  code: string;
  destination_url: string;
  is_active: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
  last_clicked_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminShortLinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<ShortLink | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const createdShortUrl = createdLink
    ? `${SHORT_LINK_BASE_URL}/${createdLink.code}`
    : "";

  async function authorizedFetch(
    input: RequestInfo | URL,
    init: RequestInit = {}
  ) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    }

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${session.access_token}`);

    return fetch(input, { ...init, headers });
  }

  async function loadLinks() {
    setLoading(true);
    setError("");

    try {
      const response = await authorizedFetch("/api/admin/short-links", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nie udało się pobrać linków.");
      }

      setLinks(payload.links ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać linków."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadLinks());
    // Dane są pobierane raz po wejściu do modułu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createShortLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setCreatedLink(null);
    setCreating(true);

    try {
      const response = await authorizedFetch("/api/admin/short-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationUrl }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nie udało się skrócić linku.");
      }

      const nextLink = payload.link as ShortLink;
      setCreatedLink(nextLink);
      setLinks((current) => [
        nextLink,
        ...current.filter((link) => link.id !== nextLink.id),
      ]);
      setDestinationUrl("");
      setStatus("Skrócony link jest gotowy.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Nie udało się skrócić linku."
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleLink(link: ShortLink) {
    setUpdatingId(link.id);
    setError("");
    setStatus("");

    try {
      const response = await authorizedFetch("/api/admin/short-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: link.id,
          isActive: !link.is_active,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nie udało się zmienić statusu linku.");
      }

      const updatedLink = payload.link as ShortLink;
      setLinks((current) =>
        current.map((item) => (item.id === updatedLink.id ? updatedLink : item))
      );
      setStatus(
        updatedLink.is_active
          ? `Link ${updatedLink.code} został włączony.`
          : `Link ${updatedLink.code} został wyłączony.`
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Nie udało się zmienić statusu linku."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Skopiowano skrócony link.");
      setError("");
    } catch {
      setError("Nie udało się skopiować linku. Zaznacz go i skopiuj ręcznie.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Admin
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                Skracacz linków
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Twórz krótkie adresy i kontroluj, które z nich są aktywne.
              </p>
            </div>

            <Link
              href="/admin/users"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Wróć do panelu
            </Link>
          </div>

          <form
            onSubmit={createShortLink}
            className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/30"
          >
            <label
              htmlFor="destination-url"
              className="text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              Link do skrócenia
            </label>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Wklej pełny adres, np. link do Google, Facebooka lub formularza.
            </p>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                id="destination-url"
                type="url"
                required
                value={destinationUrl}
                onChange={(event) => setDestinationUrl(event.target.value)}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
              />
              <button
                type="submit"
                disabled={creating || !destinationUrl.trim()}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Skracanie..." : "Skróć link"}
              </button>
            </div>
          </form>

          {createdLink && createdShortUrl && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                Gotowe — Twój skrócony link
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  readOnly
                  value={createdShortUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-4 py-3 font-mono text-sm font-semibold text-slate-900 dark:border-emerald-900 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => void copyToClipboard(createdShortUrl)}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Kopiuj
                </button>
              </div>
            </div>
          )}

          {(error || status) && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
                error
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
              }`}
            >
              {error || status}
            </div>
          )}

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Utworzone linki
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ostatnie 200 adresów oraz liczba ich użyć.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadLinks()}
                disabled={loading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Odśwież
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Ładowanie linków...
              </div>
            ) : links.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Nie ma jeszcze żadnych skróconych linków.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-950/50">
                      <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Krótki link</th>
                        <th className="px-4 py-3">Przekierowuje do</th>
                        <th className="px-4 py-3 text-center">Kliknięcia</th>
                        <th className="px-4 py-3">Utworzono</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {links.map((link) => {
                        const shortUrl = `${SHORT_LINK_BASE_URL}/${link.code}`;

                        return (
                          <tr
                            key={link.id}
                            className="bg-white align-top dark:bg-slate-900"
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <a
                                  href={shortUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono font-bold text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  /{link.code}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void copyToClipboard(shortUrl)}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  Kopiuj
                                </button>
                              </div>
                            </td>
                            <td className="max-w-md px-4 py-4">
                              <a
                                href={link.destination_url}
                                target="_blank"
                                rel="noreferrer"
                                title={link.destination_url}
                                className="block truncate text-slate-700 hover:text-blue-600 hover:underline dark:text-slate-300 dark:hover:text-blue-400"
                              >
                                {link.destination_url}
                              </a>
                              <p className="mt-1 text-xs text-slate-400">
                                Ostatnie użycie: {formatDate(link.last_clicked_at)}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-slate-900 dark:text-white">
                              {link.click_count}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-slate-500 dark:text-slate-400">
                              {formatDate(link.created_at)}
                            </td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() => void toggleLink(link)}
                                disabled={updatingId === link.id}
                                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                                  link.is_active
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {updatingId === link.id
                                  ? "Zapisywanie..."
                                  : link.is_active
                                    ? "Aktywny"
                                    : "Wyłączony"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
