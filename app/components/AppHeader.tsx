"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type AppHeaderProps = {
  currentUser?: {
    email?: string;
    user_metadata?: {
      display_name?: string;
    };
  } | null;
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/kalendarz", label: "Kalendarz" },
  { href: "/clients", label: "Kontakty" },
  { href: "/zadania", label: "Zadania" },
  { href: "/sales", label: "Sprzedaże" },
  { href: "/calculator", label: "Kalkulator ofert" },
];

const roleLabels: Record<string, string> = {
  owner: "Właściciel",
  admin: "Administrator",
  cc: "Konsultant CC",
  seller: "Doradca Techniczny",
};


type HeaderProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
};

type SearchResult = {
  id: string;
  type: "client" | "sale";
  public_id: string | null;
  title: string;
  subtitle: string | null;
};

type SearchableClient = {
  id: string;
  public_id?: string | null;
  lead_id?: string | null;
  lead_number?: string | number | null;
  full_name?: string | null;
  company_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  [key: string]: unknown;
};

type SearchableSale = {
  id: string;
  public_id?: string | null;
  sale_id?: string | null;
  sale_number?: string | number | null;
  event_id?: string | null;
  [key: string]: unknown;
};

function normalizeSearchValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

function getRecordSearchText(record: Record<string, unknown>) {
  return Object.values(record)
    .map((value) => normalizeSearchValue(value))
    .join(" ");
}

function getRecordSearchDigits(record: Record<string, unknown>) {
  return Object.values(record)
    .map((value) => String(value ?? ""))
    .join(" ")
    .replace(/\D/g, "");
}

function pickFirstString(...values: unknown[]) {
  const value = values.find(
    (item) => item !== null && item !== undefined && String(item).trim() !== ""
  );

  return value ? String(value) : null;
}

export default function AppHeader({ currentUser }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const trimmedSearch = useMemo(() => searchQuery.trim(), [searchQuery]);

  useEffect(() => {
    async function searchCRM() {
      if (trimmedSearch.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      setSearching(true);
      setSearchError(null);

      const searchValue = trimmedSearch.toLowerCase();
      const searchDigits = trimmedSearch.replace(/\D/g, "");

      const [clientsResponse, salesResponse] = await Promise.all([
        supabase.from("clients").select("*").limit(300),
        supabase.from("sales").select("*").limit(300),
      ]);

      if (clientsResponse.error || salesResponse.error) {
        console.error("Błąd wyszukiwania CRM:", {
          clients: clientsResponse.error,
          sales: salesResponse.error,
        });

        setSearchError("Nie udało się wykonać wyszukiwania.");
        setSearchResults([]);
        setSearching(false);
        return;
      }

      const clientResults: SearchResult[] = ((clientsResponse.data || []) as SearchableClient[])
        .filter((client) => {
          const searchableText = getRecordSearchText(client);
          const searchableDigits = getRecordSearchDigits(client);

          return (
            searchableText.includes(searchValue) ||
            (searchDigits.length >= 3 && searchableDigits.includes(searchDigits))
          );
        })
        .slice(0, 8)
        .map((client) => ({
          id: client.id,
          type: "client",
          public_id:
            pickFirstString(client.public_id, client.lead_id, client.lead_number) || null,
          title: client.company_name || client.full_name || client.name || "Klient",
          subtitle:
            [client.email || client.contact_email, client.phone || client.contact_phone]
              .filter(Boolean)
              .join(" • ") ||
            pickFirstString(client.public_id, client.lead_id, client.lead_number) ||
            null,
        }));

      const saleResults: SearchResult[] = ((salesResponse.data || []) as SearchableSale[])
        .filter((sale) => {
          const searchableText = getRecordSearchText(sale);
          const searchableDigits = getRecordSearchDigits(sale);

          return (
            searchableText.includes(searchValue) ||
            (searchDigits.length >= 3 && searchableDigits.includes(searchDigits))
          );
        })
        .slice(0, 8)
        .map((sale) => ({
          id: sale.id,
          type: "sale",
          public_id:
            pickFirstString(sale.public_id, sale.sale_id, sale.sale_number) || null,
          title:
            pickFirstString(sale.public_id, sale.sale_id, sale.sale_number) || "Sprzedaż",
          subtitle: "Karta sprzedaży",
        }));

      setSearchResults([...clientResults, ...saleResults]);
      setSearching(false);
    }

    const timeout = setTimeout(() => {
      searchCRM();
    }, 250);

    return () => clearTimeout(timeout);
  }, [trimmedSearch]);

  function openSearchResult(result: SearchResult) {
    setSearchQuery("");
    setShowResults(false);

    if (result.type === "sale") {
      router.push(`/sales/${result.id}`);
      return;
    }

    router.push(`/clients/${result.id}`);
  }

  async function logout() {
    await supabase.auth.signOut({ scope: "global" });

    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          localStorage.removeItem(key);
        }
      });

      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Błąd czyszczenia danych sesji:", error);
    }

    setProfile(null);
    setAuthChecked(true);
    window.location.replace("/");
  }


  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Błąd sprawdzania sesji w headerze:", sessionError);
          setProfile(null);
          return;
        }

        if (!session?.user) {
          setProfile(null);

          if (window.location.pathname !== "/") {
            window.location.replace("/");
          }

          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, display_name, role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Błąd ładowania profilu w headerze:", profileError);
        }

        setProfile(
          profileData
            ? {
                ...(profileData as Omit<HeaderProfile, "email">),
                email: session.user.email || null,
              }
            : {
                id: session.user.id,
                email: session.user.email || null,
                display_name:
                  session.user.user_metadata?.display_name ||
                  session.user.email ||
                  null,
                role: null,
              }
        );
      } catch (error) {
        console.error("Nieoczekiwany błąd ładowania profilu w headerze:", error);
        setProfile(null);

        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }
      } finally {
        setAuthChecked(true);
      }
    }

    loadProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setAuthChecked(true);

        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }

        return;
      }

      loadProfile();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="flex items-center justify-between mb-10 gap-6 flex-wrap text-slate-900">
      <div>
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="IdeaSol CRM"
            className="h-[72px] w-auto"
          />

          <span className="text-lg font-bold text-slate-900">CRM</span>
        </div>

        {authChecked && profile && (
          <p className="text-slate-500 mt-1">
            Witaj, {profile.display_name || profile.email}

            {profile.role && (
              <span className="ml-2 text-slate-400">
                • {roleLabels[profile.role] || profile.role}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end relative">
        <div
          className="group relative h-12 w-12 shrink-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setShowResults(false);
              setSearchQuery("");
            }
          }}
        >
          <div className="absolute right-0 top-0 h-12 w-12 overflow-visible transition-all duration-300 ease-out group-hover:-right-3 group-hover:w-[320px] group-focus-within:-right-3 group-focus-within:w-[320px]">
          <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center text-slate-500 transition-colors group-hover:text-emerald-500 group-focus-within:text-emerald-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Szukaj klienta, SaleID, LeadID, telefonu..."
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 shadow-sm transition-all duration-300 ease-out placeholder:text-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 group-hover:placeholder:text-slate-400 group-focus-within:placeholder:text-slate-400"
          />

          {showResults && trimmedSearch.length >= 2 && (
            <div className="absolute top-full right-0 mt-2 min-w-[320px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50">
              {searching ? (
                <div className="px-4 py-4 text-sm text-slate-500">
                  Wyszukiwanie...
                </div>
              ) : searchError ? (
                <div className="px-4 py-4 text-sm text-red-600">
                  {searchError}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500">
                  Brak wyników.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        openSearchResult(result);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {result.title}
                          </p>

                          {result.subtitle && (
                            <p className="text-xs text-slate-500 truncate mt-1">
                              {result.subtitle}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span
                            className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                              result.type === "sale"
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-sky-100 text-sky-900"
                            }`}
                          >
                            {result.type === "sale" ? "Sprzedaż" : "Klient"}
                          </span>

                          {result.public_id && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {result.public_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <nav className="ml-3 flex h-12 items-center gap-2 bg-white border border-slate-200 rounded-xl px-1 py-1 shadow-sm flex-wrap">
          {navItems.map((item) => {
            const isExternal = "external" in item && item.external;

            const isActive =
              !isExternal &&
              (item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href));

            return isExternal ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-sm font-medium transition text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-emerald-500 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              onMouseEnter={() => setProfileMenuOpen(true)}
              title="Profil"
              aria-label="Profil"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>

            {profileMenuOpen && (
              <div
                className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70"
                onMouseEnter={() => setProfileMenuOpen(true)}
                onMouseLeave={() => setProfileMenuOpen(false)}
              >
                <Link
                  href="/settings"
                  className="block px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Ustawienia
                </Link>

              </div>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            title="Wyloguj"
            aria-label="Wyloguj"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-red-50 hover:text-red-600"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </nav>
      </div>
    </header>
  );
}