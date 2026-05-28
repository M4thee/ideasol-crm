"use client";

import { useMemo, useState } from "react";

export default function SignatureGeneratorPage() {
  const [name, setName] = useState("Mateusz Rapczewski");
  const [position, setPosition] = useState("Techniczno-handlowy");
  const [phone, setPhone] = useState("+48 000 000 000");
  const [email, setEmail] = useState("kontakt@ideasol.pl");
  const [logoUrl, setLogoUrl] = useState(
    "https://crm.ideasol.pl/logo.png"
  );

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
        <strong style="color:#111827;">Adres: </strong> IdeaSol, ul. Złota 23/316, 25-015 Kielce
      </div>
    </td>
  </tr>
</table>`;
  }, [name, position, phone, email, logoUrl]);

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

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-slate-800">
                Stanowisko
              </span>

              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              >
                <option value="Doradca Techniczno-handlowy">
                 Doradca Techniczno-handlowy
                </option>

                <option value="Dyrektor ds. Handlowych">
                  Dyrektor ds. Handlowych
                </option>
              </select>
            </label>

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