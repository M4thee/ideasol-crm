"use client";


import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignatureGeneratorPage() {
  const [name, setName] = useState("Mateusz Rapczewski");
  const [position, setPosition] = useState("Techniczno-handlowy");
  const [phone, setPhone] = useState("+48 000 000 000");
  const [email, setEmail] = useState("kontakt@ideasol.pl");
  const [logoUrl, setLogoUrl] = useState(
    "https://crm.ideasol.pl/logo.png"
  );

  const [currentRole, setCurrentRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      setCurrentRole(data?.role ?? null);
    }

    loadRole();
  }, []);

  const canUseVcardGenerator =
    currentRole === "admin" || currentRole === "owner";

  const html = useMemo(() => {
    return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family: Arial, Helvetica, sans-serif; color:#1f2937; border-collapse:collapse;">
  <tr>
    <td style="vertical-align:middle; padding:0 18px 0 0;">
      <img src="${logoUrl}" alt="IdeaSol" width="140" style="display:block; width:140px; max-width:140px; height:auto; border:0;">
    </td>

    <td width="2" style="width:2px; background:#14b8a6; font-size:1px; line-height:1px;">&nbsp;</td>

    <td style="vertical-align:middle; padding:0 0 0 20px;">
      <div style="font-size:24px; line-height:29px; font-weight:700; color:#111827;">
        ${name}
      </div>

      <div style="font-size:14px; line-height:20px; color:#14b8a6; font-weight:700; padding-top:3px; padding-bottom:12px;">
        ${position}
      </div>

      <div style="font-size:14px; line-height:22px; color:#374151;">
        <strong style="color:#111827;">Tel: </strong> ${phone}<br>
        <strong style="color:#111827;">Mail: </strong> ${email}<br>
        <strong style="color:#111827;">Adres: </strong> ul. Złota 23/316, 25-015 Kielce
      </div>
    </td>
  </tr>
</table>`;
  }, [name, position, phone, email, logoUrl]);

  const normalizedName = name.trim();
  const nameParts = normalizedName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ");

  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${lastName};${firstName};;;`,
    `FN:${normalizedName}`,
    "ORG:IdeaSol Sp. z o.o.",
    `TITLE:${position}`,
    `TEL;TYPE=CELL,VOICE:${phone}`,
    `EMAIL;TYPE=INTERNET:${email}`,
    "ADR;TYPE=WORK:;;ul. Złota 23/316;Kielce;;25-015;Polska",
    "URL:https://www.ideasol.pl",
    "END:VCARD",
  ].join("\n");

  function escapeMeCardValue(value: string) {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/:/g, "\\:")
      .replace(/,/g, "\\,")
      .trim();
  }

  const qrPayload = [
    "MECARD:",
    `N:${escapeMeCardValue(normalizedName)};`,
    `ORG:${escapeMeCardValue("IdeaSol Sp. z o.o.")};`,
    `TEL:${escapeMeCardValue(phone)};`,
    `EMAIL:${escapeMeCardValue(email)};`,
    `URL:${escapeMeCardValue("https://www.ideasol.pl")};`,
    `ADR:${escapeMeCardValue("ul. Złota 23/316, 25-015 Kielce, Polska")};`,
    `NOTE:${escapeMeCardValue(position)};`,
    ";",
  ].join("");

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&ecc=L&margin=8&data=${encodeURIComponent(qrPayload)}`;

  async function copySignature() {
    const preview = document.getElementById("signature-preview");

    if (!preview) return;

    const range = document.createRange();
    range.selectNodeContents(preview);

    const selection = window.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);

    document.execCommand("copy");

    selection?.removeAllRanges();

    alert("Stopka skopiowana. Wklej ją teraz w Outlook Web App.");
  }

  async function copyHtml() {
    await navigator.clipboard.writeText(html);

    alert("HTML skopiowany.");
  }

  function downloadVcard() {
    const blob = new Blob([vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${normalizedName.toLowerCase().replace(/\s+/g, "-") || "ideasol-kontakt"}.vcf`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-950">
            Generator stopki mailowej IdeaSol
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Wypełnij dane, skopiuj stopkę i wklej ją w Outlook Web App.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <Field
              label="Imię i nazwisko"
              value={name}
              onChange={setName}
            />

            <Field
              label="Stanowisko"
              value={position}
              onChange={setPosition}
            />

            <Field
              label="Telefon"
              value={phone}
              onChange={setPhone}
            />

            <Field
              label="E-mail"
              value={email}
              onChange={setEmail}
            />

            <Field
              label="Link do logo"
              value={logoUrl}
              onChange={setLogoUrl}
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={copySignature}
                className="rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-600"
              >
                Kopiuj gotową stopkę
              </button>

              <button
                onClick={copyHtml}
                className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-300"
              >
                Kopiuj HTML
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-cyan-50 p-5 text-sm text-cyan-900">
              <p className="mb-3 font-bold text-cyan-950">
                Instrukcja dodawania stopki w Outlook Online
              </p>

              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Wygeneruj stopkę powyżej i skopiuj do schowka przyciskiem
                  <b> Kopiuj gotową stopkę</b>.
                </li>

                <li>Zaloguj się do Outlook Online.</li>

                <li>Wybierz kolejno Plik &gt; Ustawienia.</li>

                <li>
                  W panelu ustawień wybierz Konto, a następnie Podpisy.
                </li>

                <li>
                  Kliknij „Dodaj podpis”, wprowadź nazwę podpisu, a niżej
                  wklej skopiowaną zawartość z generatora i kliknij Zapisz.
                </li>

                <li>
                  W menu podpisów wybierz, że podpis ma być domyślnym dla
                  nowych maili (lub również odpowiedzi jeżeli chcesz).
                </li>
              </ol>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">
              Podgląd stopki
            </p>

            <div
              id="signature-preview"
              className="overflow-auto rounded-xl border border-dashed border-slate-300 bg-white p-6"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">
              HTML
            </p>

            <textarea
              readOnly
              value={html}
              className="h-64 w-full rounded-xl border border-slate-300 p-4 font-mono text-xs text-slate-700"
            />

            {canUseVcardGenerator && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="mb-4 text-lg font-bold text-emerald-900">
                  Generator vCard / QR (Admin / Owner)
                </h3>

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                  <div>
                    <img
                      src={qrUrl}
                      alt="QR vCard"
                      className="rounded-xl border border-emerald-200 bg-white p-2"
                    />

                    <button
                      onClick={downloadVcard}
                      className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
                    >
                      Pobierz vCard (.vcf)
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-900">
                        Dane zapisane w QR — pełna wizytówka MECARD
                      </p>
                      <p className="mb-3 text-xs text-emerald-800">
                        QR zawiera imię i nazwisko, stanowisko, telefon, e-mail, nazwę firmy, adres oraz stronę WWW.
                      </p>

                      <textarea
                        readOnly
                        value={qrPayload}
                        className="h-24 w-full rounded-xl border border-slate-300 p-4 font-mono text-xs text-slate-700"
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-900">
                        Plik vCard do pobrania
                      </p>

                      <textarea
                        readOnly
                        value={vcard}
                        className="h-36 w-full rounded-xl border border-slate-300 p-4 font-mono text-xs text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-sm font-bold text-slate-800">
        {label}
      </span>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
      />
    </label>
  );
}