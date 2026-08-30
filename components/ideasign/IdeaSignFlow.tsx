"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { IdeaSignDocumentDto, IdeaSignFlowStep, IdeaSignSessionDto } from "@/lib/ideasign/types";

const DEMO_ENTRY_OTP = "482913";
const DEMO_SIGNATURE_OTP = "739204";
const PdfPreview = dynamic(() => import("./PdfPreview"), { ssr: false });

const demoDocuments: IdeaSignDocumentDto[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Umowa sprzedaży i montażu",
    fileName: "Umowa_IS-2026-0841.pdf",
    kind: "agreement",
    sha256: "4f0f598e9f184d18c4ec6cc94021fc657ae256ef4d9e8c994c7af7b21685a20d",
    byteSize: 1_842_176,
    acceptanceRequired: true,
    previewUrl: "/templates/ideasign-demo/agreement.pdf",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Załącznik nr 1 — odstąpienie i rozpoczęcie realizacji",
    fileName: "zalacznik-1-odstapienie.pdf",
    kind: "withdrawal_form",
    sha256: "8e4e76b46d2973cf72dc74282a561814d6cc00f190f9970725aec2639e5379e7",
    byteSize: 412_844,
    acceptanceRequired: true,
    previewUrl: "/templates/ideasign-demo/attachment-1.pdf",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Załącznik nr 2 — warunki gwarancji",
    fileName: "zalacznik-2-warunki-gwarancji.pdf",
    kind: "attachment",
    sha256: "a6ee6f49c98e3f3ace85c29120c7dfe3212806317b6b58af9ca748d7364f58ae",
    byteSize: 287_103,
    acceptanceRequired: true,
    previewUrl: "/templates/ideasign-demo/attachment-2.pdf",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    title: "Załącznik nr 3 — RODO i zgody marketingowe",
    fileName: "zalacznik-3-rodo-i-zgody.pdf",
    kind: "consumer_information",
    sha256: "b6ee6f49c98e3f3ace85c29120c7dfe3212806317b6b58af9ca748d7364f58af",
    byteSize: 198_103,
    acceptanceRequired: true,
    previewUrl: "/templates/ideasign-demo/attachment-3.pdf",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Pełnomocnictwo ZM",
    fileName: "pelnomocnictwo-zm.pdf",
    kind: "attachment",
    sha256: "c6ee6f49c98e3f3ace85c29120c7dfe3212806317b6b58af9ca748d7364f58ac",
    byteSize: 162_103,
    acceptanceRequired: true,
    previewUrl: "/templates/ZM.pdf",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    title: "Dokumenty PPOŻ",
    fileName: "ppoz.pdf",
    kind: "attachment",
    sha256: "d6ee6f49c98e3f3ace85c29120c7dfe3212806317b6b58af9ca748d7364f58ad",
    byteSize: 244_103,
    acceptanceRequired: true,
    previewUrl: "/templates/PPOZ.pdf",
  },
];

const demoSession: IdeaSignSessionDto = {
  transactionId: "IS-SIGN-2026-08-0841",
  status: "wysłana",
  clientDisplayName: "Jan Kowalski",
  contractNumber: "IS/0841/08/2026",
  offeredAt: "2026-08-30T09:32:00.000Z",
  expiresAt: "2026-09-06T21:59:59.000Z",
  phoneSuffix: "4821",
  emailMasked: "ja••••••@example.com",
  manifestSha256: "23c3dc291bb2986f3789988dbbfb7adb7e9c5803802f54a4ab5d2ddaa76514ec",
  offerorName: "Mateusz Rapczewski",
  offerorCapacity: "Ekspert ds. energetyki odnawialnej",
  entryVerified: false,
  signerSigned: false,
  signerOrder: 2,
  signerCount: 2,
  signedSignerCount: 1,
  openedDocumentIds: [],
  documents: demoDocuments,
};

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function formatBytes(bytes: number) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`
    : `${Math.ceil(bytes / 1000)} KB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Warsaw",
  }).format(date);
  return `${datePart}, ${timePart}`;
}

function Progress({ step }: { step: IdeaSignFlowStep }) {
  const active = step === "link" || step === "entry-otp" ? 1 : step === "documents" ? 2 : step === "signature-otp" ? 3 : step === "completed" ? 4 : 0;
  const labels = ["Weryfikacja", "Dokumenty", "Potwierdzenie", "Gotowe"];

  return (
    <div className="grid grid-cols-4 gap-2" aria-label="Postęp zawierania umowy">
      {labels.map((label, index) => {
        const number = index + 1;
        const reached = number <= active;
        return (
          <div key={label} className="min-w-0">
            <div className={`h-1.5 rounded-full transition ${reached ? "bg-gradient-to-r from-sky-500 to-amber-400" : "bg-white/10"}`} />
            <p className={`mt-2 truncate text-[10px] font-bold uppercase tracking-[0.13em] sm:text-xs ${reached ? "text-white" : "text-white/35"}`}>
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      autoComplete="one-time-code"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center font-mono text-3xl font-black tracking-[0.35em] text-slate-950 shadow-inner outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      aria-label="Sześciocyfrowy kod SMS"
    />
  );
}

function SuccessVisual({ animate }: { animate: boolean }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  if (!animate || prefersReducedMotion) {
    return (
      <div className="relative mx-auto h-28 w-48 sm:h-32 sm:w-56" aria-hidden="true">
        <Image src="/images/ideasign-logo.png" alt="" fill sizes="224px" className="object-contain object-center" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white" aria-hidden="true">
      <video autoPlay muted playsInline preload="auto" className="block aspect-video h-auto w-full object-contain">
        <source src="/animations/ideasign-success.webm" type="video/webm" />
      </video>
    </div>
  );
}

export default function IdeaSignFlow({ demo = false }: { demo?: boolean }) {
  const [step, setStep] = useState<IdeaSignFlowStep>(demo ? "link" : "loading");
  const [session, setSession] = useState<IdeaSignSessionDto | null>(demo ? demoSession : null);
  const [csrfToken, setCsrfToken] = useState("");
  const [otp, setOtp] = useState("");
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [openedIds, setOpenedIds] = useState<string[]>(demo ? demoSession.openedDocumentIds : []);
  const [preview, setPreview] = useState<IdeaSignDocumentDto | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [deliveryPassword, setDeliveryPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [contractConcluded, setContractConcluded] = useState(true);
  const [successAnimationConfirmed, setSuccessAnimationConfirmed] = useState(false);

  const allAccepted = useMemo(() => {
    const required = session?.documents.filter((document) => document.acceptanceRequired) || [];
    return required.length > 0 && required.every((document) => acceptedIds.includes(document.id));
  }, [acceptedIds, session]);

  useEffect(() => {
    if (demo) return;

    async function bootstrap() {
      try {
        setError("");
        const token = window.location.hash.startsWith("#token=")
          ? decodeURIComponent(window.location.hash.slice("#token=".length))
          : "";

        let resolvedCsrf = getCookie("ideasign_csrf");
        if (token) {
          window.history.replaceState(null, "", "/sign");
          const exchangeResponse = await fetch("/api/ideasign/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const exchange = await exchangeResponse.json();
          if (!exchangeResponse.ok) throw new Error(exchange.error || "Link jest nieprawidłowy.");
          resolvedCsrf = exchange.csrfToken;
          setCsrfToken(resolvedCsrf);
        } else {
          setCsrfToken(resolvedCsrf);
        }

        const stateResponse = await fetch("/api/ideasign/session", { cache: "no-store" });
        const state = await stateResponse.json();
        if (!stateResponse.ok) throw new Error(state.error || "Sesja IdeaSign wygasła.");
        setSession(state.session);
        setOpenedIds(state.session.openedDocumentIds || []);

        if (state.session.signerSigned || state.session.status === "zawarta") {
          setContractConcluded(state.session.status === "zawarta");
          setSuccessAnimationConfirmed(true);
          setStep("completed");
        } else if (state.session.entryVerified) {
          setStep("documents");
        } else {
          setStep("link");
        }
      } catch (bootstrapError) {
        setError(bootstrapError instanceof Error ? bootstrapError.message : "Nie udało się otworzyć procesu IdeaSign.");
        setStep("error");
      }
    }

    void bootstrap();
  }, [demo]);

  useEffect(() => {
    if (!demo || window.location.hash !== "#pdf-preview") return;
    const frame = window.requestAnimationFrame(() => {
      setOpenedIds([demoDocuments[0].id]);
      setPreview(demoDocuments[0]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [demo]);

  async function requestOtp(purpose: "entry" | "signature") {
    setBusy(true);
    setError("");
    try {
      if (demo) {
        setOtp("");
        setStep(purpose === "entry" ? "entry-otp" : "signature-otp");
        return;
      }

      const token = csrfToken || getCookie("ideasign_csrf");
      const response = await fetch("/api/ideasign/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-IdeaSign-CSRF": token },
        body: JSON.stringify({ purpose }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się wysłać kodu SMS.");
      setOtp("");
      setStep(purpose === "entry" ? "entry-otp" : "signature-otp");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nie udało się wysłać kodu SMS.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(purpose: "entry" | "signature") {
    setBusy(true);
    setError("");
    try {
      if (demo) {
        const expected = purpose === "entry" ? DEMO_ENTRY_OTP : DEMO_SIGNATURE_OTP;
        if (otp !== expected) throw new Error("Nieprawidłowy kod SMS. Użyj kodu widocznego w podglądzie.");
        if (purpose === "entry") {
          setSession((current) => current ? { ...current, entryVerified: true, status: "uwierzytelniona" } : current);
          setStep("documents");
        } else {
          setCompletedAt(new Date().toISOString());
          setSession((current) => current ? { ...current, status: "zawarta" } : current);
          setDeliveryPassword("IDEA-7K9M-4Q2P");
          setContractConcluded(true);
          setSuccessAnimationConfirmed(true);
          setStep("completed");
        }
        setOtp("");
        return;
      }

      const token = csrfToken || getCookie("ideasign_csrf");
      const endpoint = purpose === "signature" ? "/api/ideasign/finalize" : "/api/ideasign/otp/verify";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-IdeaSign-CSRF": token },
        body: JSON.stringify({ purpose, code: otp }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kod SMS jest nieprawidłowy.");
      setOtp("");
      if (purpose === "entry") setStep("documents");
      else {
        setCompletedAt(result.concludedAt || result.signedAt || new Date().toISOString());
        setDeliveryPassword(result.password || "");
        setContractConcluded(result.contractConcluded !== false);
        setSuccessAnimationConfirmed(true);
        setSession((current) => current ? {
          ...current,
          status: result.contractConcluded === false ? "częściowo_podpisana" : "zawarta",
          signedSignerCount: Math.min(current.signerCount, current.signedSignerCount + 1),
        } : current);
        setStep("completed");
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Kod SMS jest nieprawidłowy.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptAndSign() {
    if (!allAccepted) return;
    setBusy(true);
    setError("");
    try {
      if (demo) {
        setOtp("");
        setStep("signature-otp");
        return;
      }

      const token = csrfToken || getCookie("ideasign_csrf");
      const response = await fetch("/api/ideasign/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-IdeaSign-CSRF": token },
        body: JSON.stringify({ documentIds: acceptedIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się zapisać akceptacji.");
      setOtp("");
      setStep("signature-otp");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Nie udało się zapisać akceptacji.");
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(document: IdeaSignDocumentDto) {
    setBusy(true);
    setError("");
    try {
      if (demo) {
        setOpenedIds((current) => [...new Set([...current, document.id])]);
        setPreview(document);
        return;
      }
      const response = await fetch(document.previewUrl, { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Nie udało się otworzyć dokumentu.");
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      setOpenedIds((current) => [...new Set([...current, document.id])]);
      setPreview({ ...document, previewUrl: blobUrl });
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Nie udało się otworzyć dokumentu.");
    } finally {
      setBusy(false);
    }
  }

  function closePreview() {
    if (preview?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(preview.previewUrl);
    setPreview(null);
  }

  function downloadPassword() {
    if (!deliveryPassword) return;
    const content = `Hasło do dokumentów IdeaSign\nUmowa: ${session?.contractNumber || ""}\nID transakcji: ${session?.transactionId || ""}\nHasło: ${deliveryPassword}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `haslo-IdeaSign-${session?.transactionId || "umowa"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04111f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(0,139,255,0.24),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(255,174,0,0.2),transparent_28%),linear-gradient(145deg,#020914_0%,#06233d_50%,#071321_100%)]" />
      <div className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <Image src="/images/ideasign-logo.png" alt="IdeaSign" fill sizes="64px" className="object-contain object-center" priority />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight sm:text-xl">IdeaSign</p>
              <p className="text-xs font-medium text-white/45">Bezpieczne zawieranie umów IdeaSol</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            Połączenie chronione
          </div>
        </header>

        <div className="mt-8"><Progress step={step} /></div>

        <section className="mx-auto my-auto w-full max-w-4xl py-8">
          {demo && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              <span><strong>Podgląd lokalny.</strong> Żaden SMS ani e-mail nie zostanie wysłany.</span>
              <span className="hidden rounded-full bg-black/20 px-3 py-1 font-mono text-xs sm:inline">DEMO</span>
            </div>
          )}

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white text-slate-950 shadow-2xl shadow-black/30">
            {step === "loading" && (
              <div className="p-10 text-center sm:p-16">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
                <p className="mt-5 font-semibold text-slate-600">Otwieramy bezpieczną sesję…</p>
              </div>
            )}

            {(step === "link" || step === "entry-otp") && session && (
              <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
                <div className="p-7 sm:p-10">
                  <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-sky-700">Weryfikacja dostępu</span>
                  <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Dzień dobry, {session.clientDisplayName.split(" ")[0]}</h1>
                  <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                    IdeaSol przesłało do Ciebie umowę nr <strong className="text-slate-950">{session.contractNumber}</strong>. Zanim pokażemy dokumenty, potwierdź numer telefonu jednorazowym kodem SMS.
                  </p>

                  {step === "link" ? (
                    <button disabled={busy} onClick={() => void requestOtp("entry")} className="mt-8 w-full rounded-2xl border border-blue-800/20 bg-gradient-to-r from-sky-600 to-blue-700 px-5 py-4 text-base font-black text-white transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-50 sm:w-auto sm:min-w-64">
                      {busy ? "Wysyłamy kod…" : "Wyślij kod SMS"}
                    </button>
                  ) : (
                    <div className="mt-8 max-w-md">
                      <p className="mb-3 text-sm font-bold text-slate-700">Kod wysłany na numer kończący się •••• {session.phoneSuffix}</p>
                      {demo && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Kod demonstracyjny: <strong className="font-mono text-base">{DEMO_ENTRY_OTP}</strong></div>}
                      <OtpInput value={otp} onChange={setOtp} />
                      <button disabled={busy || otp.length !== 6} onClick={() => void verifyOtp("entry")} className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                        {busy ? "Sprawdzamy…" : "Potwierdź i pokaż dokumenty"}
                      </button>
                      <button disabled={busy} onClick={() => void requestOtp("entry")} className="mt-3 w-full text-sm font-bold text-sky-700 hover:text-sky-900">Wyślij kod ponownie</button>
                    </div>
                  )}
                  {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
                </div>

                <aside className="border-t border-slate-200 bg-slate-50 p-7 lg:border-l lg:border-t-0 sm:p-10">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Szczegóły oferty</p>
                  <dl className="mt-5 space-y-5">
                    <div><dt className="text-xs font-bold text-slate-400">Umowa</dt><dd className="mt-1 font-black text-slate-900">{session.contractNumber}</dd></div>
                    <div><dt className="text-xs font-bold text-slate-400">Oferta złożona przez</dt><dd className="mt-1 font-bold text-slate-900">{session.offerorName}</dd><dd className="text-sm text-slate-500">{session.offerorCapacity}</dd></div>
                    <div><dt className="text-xs font-bold text-slate-400">Ważna do</dt><dd className="mt-1 font-bold text-slate-900">{formatDate(session.expiresAt)}</dd></div>
                    <div><dt className="text-xs font-bold text-slate-400">ID transakcji</dt><dd className="mt-1 break-all font-mono text-xs text-slate-600">{session.transactionId}</dd></div>
                  </dl>
                </aside>
              </div>
            )}

            {step === "documents" && session && (
              <div>
                <div className="border-b border-slate-200 p-7 sm:p-10">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700">Tożsamość potwierdzona</span>
                  <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Zapoznaj się z dokumentami</h1>
                  <p className="mt-3 max-w-2xl leading-7 text-slate-600">Otwórz każdy dokument i potwierdź go osobno. Akceptujesz dokładnie wskazane wersje oznaczone skrótem SHA-256.</p>
                  {session.signerCount > 1 && <p className="mt-3 text-sm font-bold text-sky-700">Podpisujący {session.signerOrder} z {session.signerCount} · podpisano: {session.signedSignerCount}/{session.signerCount}</p>}
                </div>

                <div className="space-y-4 bg-slate-50 p-5 sm:p-8">
                  {session.documents.map((document, index) => {
                    const checked = acceptedIds.includes(document.id);
                    const opened = openedIds.includes(document.id);
                    return (
                      <article key={document.id} className={`rounded-2xl border bg-white p-5 transition ${checked ? "border-emerald-300 ring-4 ring-emerald-50" : "border-slate-200"}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-black text-sky-700">{index + 1}</div>
                            <div className="min-w-0"><h2 className="font-black text-slate-950">{document.title}</h2><p className="mt-1 text-sm text-slate-500">{document.fileName} · {formatBytes(document.byteSize)}</p><p className="mt-2 break-all font-mono text-[10px] leading-4 text-slate-400">SHA-256: {document.sha256}</p></div>
                          </div>
                          <button disabled={busy} onClick={() => void openDocument(document)} className="shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-black text-sky-700 hover:bg-sky-100 disabled:opacity-50">{opened ? "Otwórz ponownie" : "Otwórz PDF"}</button>
                        </div>
                        <label className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 ${opened ? "cursor-pointer border-slate-200 bg-slate-50" : "cursor-not-allowed border-slate-100 bg-slate-100/70"}`}>
                          <input type="checkbox" disabled={!opened} checked={checked} onChange={(event) => setAcceptedIds((current) => event.target.checked ? [...new Set([...current, document.id])] : current.filter((id) => id !== document.id))} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600 disabled:opacity-40" />
                          <span className={`text-sm font-semibold leading-6 ${opened ? "text-slate-700" : "text-slate-400"}`}>{opened ? `Zapoznałem/am się z treścią dokumentu „${document.title}” i akceptuję jego treść.` : "Checkbox uaktywni się po faktycznym otwarciu PDF."}</span>
                        </label>
                      </article>
                    );
                  })}

                  {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
                  <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">SMS</div>
                    <div>
                      <p className="text-sm font-black text-slate-950">Potwierdzenie podpisu</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">Po kliknięciu wyślemy na Twój numer drugi kod SMS przypisany do dokładnie tej wersji dokumentów. Wpisanie kodu zapisze Twój podpis elektroniczny i potwierdzi zgodę na zawarcie umowy z obowiązkiem zapłaty.</p>
                    </div>
                  </div>
                  <button disabled={!allAccepted || busy} onClick={() => void acceptAndSign()} className="w-full rounded-2xl border border-orange-600/20 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 px-5 py-4 text-base font-black text-white transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40">
                    {busy ? "Przygotowujemy potwierdzenie…" : "Podpisuję umowę z obowiązkiem zapłaty"}
                  </button>
                </div>
              </div>
            )}

            {step === "signature-otp" && session && (
              <div className="mx-auto max-w-2xl p-7 text-center sm:p-12">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-2xl">✓</div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-amber-600">Ostatni krok</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Potwierdź zawarcie umowy</h1>
                <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">Kod jest przypisany do wersji dokumentów o skrócie <span className="font-mono text-xs text-slate-500">{session.manifestSha256.slice(0, 20)}…</span></p>
                <div className="mx-auto mt-7 max-w-md">
                  {demo && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Kod demonstracyjny: <strong className="font-mono text-base">{DEMO_SIGNATURE_OTP}</strong></div>}
                  <OtpInput value={otp} onChange={setOtp} />
                  <button disabled={busy || otp.length !== 6} onClick={() => void verifyOtp("signature")} className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Zawieramy umowę…" : "Potwierdzam zawarcie umowy"}</button>
                  <button disabled={busy} onClick={() => void requestOtp("signature")} className="mt-3 w-full text-sm font-bold text-sky-700 hover:text-sky-900">Wyślij kod ponownie</button>
                </div>
                {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              </div>
            )}

            {step === "completed" && session && (
              <div className="p-7 text-center sm:p-12">
                <SuccessVisual animate={successAnimationConfirmed} />
                <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">{contractConcluded ? "Umowa zawarta" : "Twój podpis zapisany"}</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Dziękujemy, {session.clientDisplayName.split(" ")[0]}</h1>
                <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">{contractConcluded ? <>Umowa została zawarta drogą elektroniczną{completedAt ? ` ${formatDate(completedAt)}` : ""}. Obustronnie podpisana umowa zostanie wysłana na adres {session.emailMasked}.</> : <>Twój podpis został zapisany{completedAt ? ` ${formatDate(completedAt)}` : ""}. Umowa zostanie zawarta, gdy podpisze ją druga osoba; wtedy obustronnie podpisana umowa zostanie wysłana na adres {session.emailMasked}.</>}</p>
                {deliveryPassword && (
                  <div className="mx-auto mt-7 max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/70 p-5 text-left shadow-sm sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                          <rect x="5" y="10" width="14" height="10" rx="3" />
                          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-black text-slate-950">Zapisz hasło do dokumentu</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">Ze względów bezpieczeństwa hasło nie trafi do wiadomości e-mail i nie będzie można go później ponownie wyświetlić.</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <div className="flex min-h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 font-mono text-base font-black tracking-[0.16em] text-slate-950 shadow-inner shadow-slate-100">{passwordVisible ? deliveryPassword : "••••-••••-••••-••••"}</div>
                      <button type="button" onClick={() => setPasswordVisible((value) => !value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">{passwordVisible ? "Ukryj" : "Pokaż"}</button>
                      <button type="button" onClick={downloadPassword} className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800">Pobierz hasło</button>
                    </div>
                  </div>
                )}
                {!deliveryPassword && session.signerSigned && (
                  <p className="mx-auto mt-6 max-w-xl rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">Ze względów bezpieczeństwa hasło nie jest ponownie wyświetlane po odświeżeniu strony. Użyj zapisanej kopii hasła.</p>
                )}
                <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">ID transakcji</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{session.transactionId}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">Numer umowy</p><p className="mt-1 text-sm font-black text-slate-900">{session.contractNumber}</p></div>
                </div>
                {demo && <button onClick={() => { setSession(demoSession); setAcceptedIds([]); setOpenedIds([]); setCompletedAt(null); setDeliveryPassword(""); setPasswordVisible(false); setContractConcluded(true); setSuccessAnimationConfirmed(false); setOtp(""); setError(""); setStep("link"); }} className="mt-8 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Uruchom demo ponownie</button>}
              </div>
            )}

            {step === "error" && (
              <div className="p-10 text-center sm:p-16"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700">!</div><h1 className="mt-5 text-3xl font-black">Nie udało się otworzyć umowy</h1><p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">{error || "Link wygasł albo został już użyty."}</p><p className="mt-5 text-sm font-semibold text-slate-400">Skontaktuj się z opiekunem IdeaSol, aby otrzymać nowy link.</p></div>
            )}
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-center text-xs text-white/40 sm:flex-row sm:text-left"><p>IdeaSol Sp. z o.o. · IdeaSign</p><p>Nie udostępniaj kodów SMS innym osobom.</p></footer>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`Podgląd: ${preview.title}`}>
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 text-slate-950"><div className="min-w-0"><p className="truncate font-black">{preview.title}</p><p className="truncate text-xs text-slate-500">{preview.fileName}</p></div><button onClick={closePreview} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">Zamknij</button></div>
            <PdfPreview key={preview.id} file={preview.previewUrl} title={preview.title} />
          </div>
        </div>
      )}
    </main>
  );
}
