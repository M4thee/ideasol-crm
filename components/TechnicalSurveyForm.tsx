"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TECHNICAL_SURVEY_DECLARATION,
  TECHNICAL_SURVEY_ROOF_ORIENTATIONS,
  getTechnicalSurveyChoice,
  technicalSurveyHasProduct,
  technicalSurveyRouteTotal,
  type TechnicalSurvey,
} from "@/lib/technicalSurvey";

type TechnicalSurveyFormProps = {
  value: TechnicalSurvey;
  onChange: (value: TechnicalSurvey) => void;
  onSave: () => Promise<void> | void;
  onPhotoUpload: (category: string, label: string, files: File[]) => Promise<void> | void;
  saving?: boolean;
  uploadingCategory?: string;
  status?: string;
};

const OSD_LABELS: Record<string, string> = {
  enea: "Enea Operator",
  tauron: "Tauron Dystrybucja",
  pge: "PGE Dystrybucja",
  energa: "Energa-Operator",
  eon: "Stoen Operator / E.ON",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-800">{label}</span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function ChoiceGroup({
  label,
  selected,
  options,
  multiple = false,
  onChange,
}: {
  label: string;
  selected: string[];
  options: string[];
  multiple?: boolean;
  onChange: (values: string[]) => void;
}) {
  function toggle(option: string) {
    if (!multiple) {
      onChange(selected.includes(option) ? [] : [option]);
      return;
    }
    const mutuallyExclusive = option === "Brak zacienień" || option === "Brak wiedzy klienta";
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
      return;
    }
    const next = mutuallyExclusive
      ? [option]
      : selected
          .filter((item) => item !== "Brak zacienień" && item !== "Brak wiedzy klienta")
          .concat(option);
    onChange(next);
  }

  return (
    <div>
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={active}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-100"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400"
              }`}
            >
              <span aria-hidden="true">{active ? "●" : "○"}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhotoField({
  label,
  uploaded,
  busy,
  onUpload,
}: {
  label: string;
  uploaded: boolean;
  busy: boolean;
  onUpload: (files: File[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-slate-900">📷 {label}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Opcjonalne. Brak zdjęcia nie blokuje umowy; można je dodać później w sprzedaży.
        </p>
      </div>
      <label
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition ${
          busy
            ? "cursor-wait bg-slate-200 text-slate-500"
            : uploaded
              ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "bg-blue-700 text-white hover:bg-blue-800"
        }`}
      >
        {busy ? "Wysyłam…" : uploaded ? "✓ Dodaj kolejne" : "Dodaj zdjęcie"}
        <input
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files || []);
            event.currentTarget.value = "";
            if (files.length) onUpload(files);
          }}
        />
      </label>
    </div>
  );
}

function SketchEditor({
  initialData,
  onCancel,
  onSave,
}: {
  initialData: string;
  onCancel: () => void;
  onSave: (data: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const pointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const snapshot = canvas.toDataURL("image/png");
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor((window.innerHeight - 74) * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight - 74}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, window.innerWidth, window.innerHeight - 74);
      context.strokeStyle = "#0f172a";
      context.lineWidth = 3;
      context.lineCap = "round";
      context.lineJoin = "round";
      const source = initialData || (snapshot.length > 100 ? snapshot : "");
      if (source) {
        const image = new window.Image();
        image.onload = () => context.drawImage(image, 0, 0, window.innerWidth, window.innerHeight - 74);
        image.src = source;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [initialData]);

  function coordinates(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white">
      <div className="flex h-[74px] items-center justify-between border-b border-slate-200 px-4 sm:px-7">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">
          Cofnij
        </button>
        <p className="text-center text-sm font-black text-slate-950 sm:text-base">Szkic ułożenia paneli</p>
        <button
          type="button"
          onClick={() => {
            const data = canvasRef.current?.toDataURL("image/png") || "";
            onSave(data);
          }}
          className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800"
        >
          Zapisz
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="block touch-none cursor-crosshair bg-white"
        onPointerDown={(event) => {
          drawingRef.current = true;
          pointRef.current = coordinates(event);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return;
          const context = event.currentTarget.getContext("2d");
          if (!context) return;
          const next = coordinates(event);
          context.beginPath();
          context.moveTo(pointRef.current.x, pointRef.current.y);
          context.lineTo(next.x, next.y);
          context.stroke();
          pointRef.current = next;
        }}
        onPointerUp={() => {
          drawingRef.current = false;
        }}
        onPointerCancel={() => {
          drawingRef.current = false;
        }}
      />
    </div>
  );
}

export default function TechnicalSurveyForm({
  value,
  onChange,
  onSave,
  onPhotoUpload,
  saving = false,
  uploadingCategory = "",
  status = "",
}: TechnicalSurveyFormProps) {
  const [sketchOpen, setSketchOpen] = useState(false);
  const hasPv = technicalSurveyHasProduct(value, "PV");
  const hasStorage = technicalSurveyHasProduct(value, "ME");
  const pvLocation = getTechnicalSurveyChoice(value, "pv_location");
  const dcGroundLength = Number(String(value.text.pv_dc_c || "0").replace(",", "."));
  const acGroundLength = Number(String(value.text.pv_ac_c || "0").replace(",", "."));
  const hasGroundRoute = dcGroundLength > 0 || acGroundLength > 0;
  const selectedRoofOrientations = TECHNICAL_SURVEY_ROOF_ORIENTATIONS.filter((orientation) =>
    value.choices.roof_orientations?.includes(orientation)
  );
  const osdLabel = OSD_LABELS[value.text.osd_operator] || value.text.osd_operator || "Nie podano";

  const photoSet = useMemo(() => new Set(value.photoChecklist), [value.photoChecklist]);

  function commit(next: TechnicalSurvey) {
    onChange({ ...next, updatedAt: new Date().toISOString() });
  }

  function setText(key: string, text: string) {
    commit({ ...value, text: { ...value.text, [key]: text } });
  }

  function setChoices(key: string, choices: string[]) {
    commit({
      ...value,
      ...(key === "products" ? { scopes: choices } : {}),
      choices: { ...value.choices, [key]: choices },
    });
  }

  function photo(category: string, label: string) {
    return (
      <PhotoField
        label={label}
        uploaded={photoSet.has(category)}
        busy={uploadingCategory === category}
        onUpload={(files) => void onPhotoUpload(category, label, files)}
      />
    );
  }

  function routeEditor(title: string, prefix: string) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="text-sm font-black text-slate-900">{title}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["a", "A · wewnątrz budynku [m]"],
            ["b", "B · po elewacji [m]"],
            ["c", "C · w gruncie [m]"],
            ["d", "D · napowietrznie [m]"],
          ].map(([suffix, label]) => (
            <Field
              key={suffix}
              label={label}
              type="number"
              value={value.text[`${prefix}_${suffix}`] || ""}
              onChange={(text) => setText(`${prefix}_${suffix}`, text)}
            />
          ))}
        </div>
        <p className="mt-3 text-sm font-black text-slate-800">
          Suma A + B + C + D: {technicalSurveyRouteTotal(value, prefix).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} m
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Załącznik nr 4</p>
        <h2 className="mt-2 text-2xl font-black">Ankieta techniczna i zdjęcia</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Ankieta zostanie zamrożona razem z umową IdeaSign. Zdjęcia przy pytaniach są opcjonalne — można je uzupełnić później na karcie sprzedaży w sekcji Dokumenty → Zdjęcia.
        </p>
      </div>

      <Section title="Dane audytu">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Klient" value={value.clientName} onChange={(clientName) => commit({ ...value, clientName })} />
          <Field label="Numer umowy" value={value.contractNumber} onChange={(contractNumber) => commit({ ...value, contractNumber })} />
          <Field label="Adres instalacji" value={value.installationAddress} onChange={(installationAddress) => commit({ ...value, installationAddress })} />
          <Field label="Audytor" value={value.auditor} onChange={(auditor) => commit({ ...value, auditor })} />
          <Field label="Data audytu" type="date" value={value.auditDate.slice(0, 10)} onChange={(auditDate) => commit({ ...value, auditDate: `${auditDate}T12:00:00.000Z` })} />
        </div>
      </Section>

      <Section title="Zakres instalacji">
        <ChoiceGroup label="Co kupuje klient" selected={value.choices.products || []} options={["PV", "ME"]} multiple onChange={(items) => setChoices("products", items)} />
        {hasPv && (
          <ChoiceGroup label="Miejsce montażu PV" selected={value.choices.pv_location || []} options={["Dach", "Grunt"]} onChange={(items) => setChoices("pv_location", items)} />
        )}
        <p className="text-xs font-semibold text-slate-500">Zakres i miejsce montażu są uzupełniane z zapisanej oferty, ale można je skorygować.</p>
      </Section>

      <Section title="A. Dane obecne">
        <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">1. Operator OSD</p>
          <p className="mt-1 font-black text-slate-900">{osdLabel}</p>
        </div>
        <ChoiceGroup label="2. Czy obecnie istnieje PV?" selected={value.choices.existing_pv || []} options={["Tak", "Nie"]} onChange={(items) => setChoices("existing_pv", items)} />
        {getTechnicalSurveyChoice(value, "existing_pv") === "Tak" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Moc istniejącej PV [kWp]" type="number" value={value.text.existing_pv_power || ""} onChange={(text) => setText("existing_pv_power", text)} />
              <Field label="Liczba paneli" type="number" value={value.text.existing_panel_count || ""} onChange={(text) => setText("existing_panel_count", text)} />
              <Field label="Falownik klienta — model" value={value.text.existing_inverter_model || ""} onChange={(text) => setText("existing_inverter_model", text)} />
              <Field label="Falownik klienta — moc [kW]" type="number" value={value.text.existing_inverter_power || ""} onChange={(text) => setText("existing_inverter_power", text)} />
            </div>
            {photo("Tabliczka znamionowa falownika klienta", "Zdjęcie tabliczki znamionowej falownika")}
          </div>
        )}
        <ChoiceGroup label="3. Wjazd na posesję" selected={value.choices.property_access || []} options={["Brak możliwości wjazdu", "Pojazd do 3,5 t", "Pojazd powyżej 3,5 t"]} onChange={(items) => setChoices("property_access", items)} />
        <Field label="Szerokość bramy wjazdowej [m]" type="number" value={value.text.gate_width || ""} onChange={(text) => setText("gate_width", text)} />
        <ChoiceGroup label="4. Liczba faz" selected={value.choices.phase_count || []} options={["1 faza", "3 fazy"]} onChange={(items) => setChoices("phase_count", items)} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="5. Moc przyłączeniowa [kW]" type="number" value={value.text.connection_power || ""} onChange={(text) => setText("connection_power", text)} />
          <Field label="Zabezpieczenie przedlicznikowe [A]" value={value.text.pre_meter_protection || ""} onChange={(text) => setText("pre_meter_protection", text)} />
        </div>
        <ChoiceGroup label="6. Lokalizacja licznika" selected={value.choices.meter_location || []} options={["Wewnątrz budynku", "Na elewacji", "W granicy posesji", "Inne"]} onChange={(items) => setChoices("meter_location", items)} />
        {getTechnicalSurveyChoice(value, "meter_location") === "Inne" && <Field label="Inna lokalizacja licznika" value={value.text.meter_location_other || ""} onChange={(text) => setText("meter_location_other", text)} />}
        {photo("Lokalizacja licznika", "Zdjęcie lokalizacji licznika")}
        <ChoiceGroup label="7. Miejsce przyłączenia instalacji" selected={value.choices.connection_point || []} options={["Rozdzielnia główna", "Bezpośrednio do licznika", "Inne"]} onChange={(items) => setChoices("connection_point", items)} />
        {getTechnicalSurveyChoice(value, "connection_point") === "Inne" && <Field label="Inne miejsce przyłączenia" value={value.text.connection_point_other || ""} onChange={(text) => setText("connection_point_other", text)} />}
      </Section>

      {hasPv && (
        <Section title="B. Planowana instalacja PV">
          <ChoiceGroup label="1. Rodzaj instalowanego inwertera" selected={value.choices.inverter_type || []} options={["Sieciowy", "Hybrydowy", "Mikrofalowniki", "Falownik klienta"]} onChange={(items) => setChoices("inverter_type", items)} />
          <ChoiceGroup label="Wykonanie inwertera" selected={value.choices.inverter_phase || []} options={["1-fazowy", "3-fazowy"]} onChange={(items) => setChoices("inverter_phase", items)} />
          <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200"><span className="text-sm font-bold text-slate-500">2. Miejsce montażu PV: </span><strong>{pvLocation || "Nie wybrano"}</strong></div>
          {photo("Miejsce montażu PV", "Zdjęcie miejsca montażu PV")}
          <ChoiceGroup label="3. Miejsce montażu inwertera i zabezpieczeń" selected={value.choices.inverter_location || []} options={["Pod konstrukcją gruntową", "Wewnątrz budynku", "Na elewacji"]} onChange={(items) => setChoices("inverter_location", items)} />
          {photo("Miejsce montażu inwertera i zabezpieczeń", "Zdjęcie miejsca montażu inwertera i zabezpieczeń")}
          {routeEditor("4. Trasa DC — panele → inwerter / zabezpieczenia", "pv_dc")}
          <ChoiceGroup label="4a. Podłoże ściany / elewacji" selected={value.choices.wall_substrate || []} options={["Drewno", "Beton / cegła", "Płyta OSB", "Inne"]} onChange={(items) => setChoices("wall_substrate", items)} />
          {getTechnicalSurveyChoice(value, "wall_substrate") === "Inne" && <Field label="Inne podłoże" value={value.text.wall_substrate_other || ""} onChange={(text) => setText("wall_substrate_other", text)} />}
          {routeEditor("5. Trasa AC — inwerter → miejsce wpięcia", "pv_ac")}
          {hasGroundRoute && (
            <div className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <ChoiceGroup label="6. Infrastruktura w gruncie na trasie kablowej" selected={value.choices.underground_infrastructure || []} options={["Brak przeszkód", "Brak wiedzy klienta", "Tak, są przeszkody"]} onChange={(items) => setChoices("underground_infrastructure", items)} />
              {getTechnicalSurveyChoice(value, "underground_infrastructure") === "Tak, są przeszkody" && <Field label="Jakie przeszkody?" value={value.text.underground_obstacles || ""} onChange={(text) => setText("underground_obstacles", text)} />}
              <ChoiceGroup label="7. Struktura gruntu" selected={value.choices.soil_structure || []} options={["Brak wiedzy klienta", "Piach", "Glina", "Gruz", "Kamień", "Inne"]} multiple onChange={(items) => setChoices("soil_structure", items)} />
              {value.choices.soil_structure?.includes("Inne") && <Field label="Inna struktura gruntu" value={value.text.soil_other || ""} onChange={(text) => setText("soil_other", text)} />}
            </div>
          )}
          <ChoiceGroup label="8. Możliwe zacienienia paneli" selected={value.choices.shading || []} options={["Brak zacienień", "Drzewa", "Budynki", "Elementy dachu", "Inne"]} multiple onChange={(items) => setChoices("shading", items)} />
          {(value.choices.shading || []).some((item) => item !== "Brak zacienień") && <Field label="Liczba paneli, które będą zacienione" type="number" value={value.text.shaded_panel_count || ""} onChange={(text) => setText("shaded_panel_count", text)} />}
          <ChoiceGroup label="9. Zasięg Wi‑Fi w miejscu montażu" selected={value.choices.wifi || []} options={["Brak", "1/5", "2/5", "3/5", "4/5", "5/5"]} onChange={(items) => setChoices("wifi", items)} />
        </Section>
      )}

      {hasPv && pvLocation === "Dach" && (
        <Section title="C. Konstrukcja dachowa">
          <Field label="1. Wysokość budynku [m]" type="number" value={value.text.building_height || ""} onChange={(text) => setText("building_height", text)} />
          <ChoiceGroup label="2. Czy jest możliwość wjazdu zwyżki?" selected={value.choices.lift_access || []} options={["Tak", "Nie"]} onChange={(items) => setChoices("lift_access", items)} />
          {getTechnicalSurveyChoice(value, "lift_access") === "Tak" && <Field label="Odstęp od ściany do miejsca podjazdu zwyżką [m]" type="number" value={value.text.lift_wall_distance || ""} onChange={(text) => setText("lift_wall_distance", text)} />}
          <ChoiceGroup label="3. Połacie planowane do montażu" selected={value.choices.roof_orientations || []} options={[...TECHNICAL_SURVEY_ROOF_ORIENTATIONS]} multiple onChange={(items) => setChoices("roof_orientations", items)} />
          {selectedRoofOrientations.map((orientation) => {
            const index = TECHNICAL_SURVEY_ROOF_ORIENTATIONS.indexOf(orientation);
            const slope = value.roofSlopes[index];
            return (
              <div key={orientation} className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <p className="font-black text-slate-950">{orientation}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {([['angle', 'Kąt [°]'], ['width', 'Szerokość [m]'], ['length', 'Długość [m]'], ['panelCount', 'Liczba paneli']] as const).map(([key, label]) => (
                    <Field key={key} label={label} type="number" value={slope[key]} onChange={(text) => {
                      const roofSlopes = value.roofSlopes.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: text } : item);
                      commit({ ...value, roofSlopes });
                    }} />
                  ))}
                </div>
                {photo(`Połać dachu — ${orientation}`, `Zdjęcie połaci: ${orientation}`)}
              </div>
            );
          })}
          <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200"><span className="text-sm font-bold text-slate-500">Pokrycie zapisane w kalkulacji: </span><strong>{value.text.roof_type_from_offer || "Nie podano"}</strong></div>
          <ChoiceGroup label="4. Poszycie dachu" selected={value.choices.roof_covering || []} options={["Papa", "Membrana", "Blacha falista", "Blacha trapez", "Blacha rąbek", "Dachówka ceramiczna", "Dachówka betonowa", "Gont", "Inne"]} multiple onChange={(items) => setChoices("roof_covering", items)} />
          {value.choices.roof_covering?.includes("Inne") && <Field label="Inne poszycie dachu" value={value.text.roof_covering_other || ""} onChange={(text) => setText("roof_covering_other", text)} />}
          <button type="button" onClick={() => setSketchOpen(true)} className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-sm font-black text-white hover:bg-blue-800">✏️ {value.sketchData ? "Edytuj zapisany szkic" : "5. Narysuj szkic ułożenia paneli"}</button>
        </Section>
      )}

      {hasStorage && (
        <Section title="D. Magazyn energii">
          <ChoiceGroup label="1. Miejsce montażu" selected={value.choices.storage_mount || []} options={["Wewnątrz budynku", "Na zewnątrz"]} onChange={(items) => setChoices("storage_mount", items)} />
          <ChoiceGroup label="2. Falownik" selected={value.choices.storage_inverter || []} options={["Hybrydowy klienta", "Dołożenie hybrydowego do sieciowego", "Wymiana na nowy hybrydowy"]} onChange={(items) => setChoices("storage_inverter", items)} />
          <div>
            <p className="text-sm font-bold text-slate-800">3. Dostępne miejsce montażu magazynu i falownika</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <Field label="Długość [m]" type="number" value={value.text.storage_length || ""} onChange={(text) => setText("storage_length", text)} />
              <Field label="Szerokość [m]" type="number" value={value.text.storage_width || ""} onChange={(text) => setText("storage_width", text)} />
              <Field label="Wysokość [m]" type="number" value={value.text.storage_height || ""} onChange={(text) => setText("storage_height", text)} />
            </div>
          </div>
          {photo("Miejsce montażu magazynu i falownika", "Zdjęcie miejsca montażu magazynu i falownika")}
          <ChoiceGroup label="4. Miejsce spełnia wymagania temperatury i suchości" selected={value.choices.storage_conditions || []} options={["Tak", "Nie"]} onChange={(items) => setChoices("storage_conditions", items)} />
          <ChoiceGroup label="5. Układ rezerwy lub agregat" selected={value.choices.backup_system || []} options={["Żaden", "Agregat", "SZR", "Oba"]} onChange={(items) => setChoices("backup_system", items)} />
          {routeEditor("6. Trasa — falownik → miejsce wpięcia", "storage_grid")}
          {routeEditor("7. Trasa — falownik → magazyn energii", "storage_battery")}
        </Section>
      )}

      <Section title="Uwagi">
        <label className="block">
          <span className="text-sm font-bold text-slate-800">Dodatkowe informacje z wizji lokalnej</span>
          <textarea value={value.technicalNotes} onChange={(event) => commit({ ...value, technicalNotes: event.target.value })} rows={5} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
        </label>
      </Section>

      <Section title="Oświadczenie klienta">
        <p className="text-sm leading-7 text-slate-700">{TECHNICAL_SURVEY_DECLARATION}</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input type="checkbox" checked={value.declarationAccepted} onChange={(event) => commit({ ...value, declarationAccepted: event.target.checked, declarationText: TECHNICAL_SURVEY_DECLARATION })} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-blue-700" />
          <span className="text-sm font-black text-slate-900">Klient potwierdza oświadczenie</span>
        </label>
      </Section>

      {status && <div role="status" className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">{status}</div>}

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">Zapis nie rozpoczyna procesu podpisu. Możesz wrócić do ankiety przed wysłaniem umowy do IdeaSign.</p>
        <button type="button" onClick={() => void onSave()} disabled={saving} className="shrink-0 rounded-2xl bg-[#119182] px-6 py-4 text-sm font-black text-white hover:bg-[#0f7f72] disabled:cursor-wait disabled:opacity-50">{saving ? "Zapisuję…" : "Zapisz ankietę"}</button>
      </div>

      {sketchOpen && <SketchEditor initialData={value.sketchData} onCancel={() => setSketchOpen(false)} onSave={(sketchData) => { commit({ ...value, sketchData }); setSketchOpen(false); }} />}
    </div>
  );
}
