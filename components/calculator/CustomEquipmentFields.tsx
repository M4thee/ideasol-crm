import { useState } from "react";
import type {
  CustomInverterEquipment,
  CustomPanelEquipment,
  CustomStorageEquipment,
} from "@/lib/calculator/customEquipment";

const inputClass =
  "mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-violet-100/40 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:border-violet-400 dark:focus:ring-violet-500/20";

const detailsClass =
  "mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-500/30 dark:bg-violet-950/20";

type CommonProps<T> = {
  value: T;
  onChange: (value: T) => void;
  onInvalidate: () => void;
};

function NumberField({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <div className="relative">
        <input
          className={`${inputClass} pr-16`}
          type="number"
          min="0"
          step="0.01"
          value={value || ""}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="pointer-events-none absolute bottom-3 right-4 text-sm font-semibold text-slate-400">
          {unit}
        </span>
      </div>
    </label>
  );
}

function WarrantyFields<T extends {
  catalogCardUrl: string;
  warrantyGuarantor: string;
  warrantyPeriod: string;
}>({
  value,
  update,
}: {
  value: T;
  update: (changes: Partial<T>) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Gwarant</span>
        <input
          className={inputClass}
          type="text"
          placeholder="np. producent / dystrybutor"
          value={value.warrantyGuarantor}
          onChange={(event) => update({ warrantyGuarantor: event.target.value } as Partial<T>)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Długość gwarancji</span>
        <input
          className={inputClass}
          type="text"
          placeholder="np. 10 lat"
          value={value.warrantyPeriod}
          onChange={(event) => update({ warrantyPeriod: event.target.value } as Partial<T>)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Karta katalogowa HTTPS</span>
        <input
          className={inputClass}
          type="url"
          placeholder="https://..."
          value={value.catalogCardUrl}
          onChange={(event) => update({ catalogCardUrl: event.target.value } as Partial<T>)}
        />
      </label>
    </div>
  );
}

export function CustomPanelFields({
  value,
  onChange,
  onInvalidate,
}: CommonProps<CustomPanelEquipment>) {
  const [showDetails, setShowDetails] = useState(false);

  function update(changes: Partial<CustomPanelEquipment>) {
    onChange({ ...value, ...changes });
    onInvalidate();
  }

  return (
    <div className="lg:col-span-3 rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-4 dark:border-violet-500/50 dark:bg-violet-950/20">
      <div className="mb-4">
        <div className="font-black text-violet-800 dark:text-violet-200">Panel niestandardowy</div>
        <p className="mt-1 text-xs text-violet-700/80 dark:text-violet-300/80">
          Sprzęt będzie zapisany tylko w tej kalkulacji i nie trafi do katalogu administratora.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block lg:col-span-1">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nazwa wyświetlana</span>
          <input
            className={inputClass}
            type="text"
            placeholder="Pełna nazwa panelu"
            value={value.displayName}
            onChange={(event) => update({ displayName: event.target.value })}
          />
        </label>
        <NumberField label="Moc jednego panelu" value={value.powerWp} unit="Wp" onChange={(powerWp) => update({ powerWp })} />
        <NumberField label="Cena zakupu netto / szt." value={value.priceNet} unit="zł" onChange={(priceNet) => update({ priceNet })} />
      </div>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-3 text-sm font-bold text-violet-800 dark:text-violet-200">
        <input type="checkbox" checked={showDetails} onChange={(event) => setShowDetails(event.target.checked)} className="h-4 w-4 accent-violet-600" />
        Dodatkowe informacje o sprzęcie
      </label>
      {showDetails ? <div className={detailsClass}><WarrantyFields value={value} update={update} /></div> : null}
    </div>
  );
}

export function CustomStorageFields({
  value,
  onChange,
  onInvalidate,
}: CommonProps<CustomStorageEquipment>) {
  const [showDetails, setShowDetails] = useState(false);

  function update(changes: Partial<CustomStorageEquipment>) {
    onChange({ ...value, ...changes });
    onInvalidate();
  }

  return (
    <div className="lg:col-span-2 rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-4 dark:border-violet-500/50 dark:bg-violet-950/20">
      <div className="mb-4 font-black text-violet-800 dark:text-violet-200">Magazyn energii niestandardowy</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nazwa wyświetlana</span>
          <input className={inputClass} type="text" placeholder="Pełna nazwa magazynu" value={value.displayName} onChange={(event) => update({ displayName: event.target.value })} />
        </label>
        <NumberField label="Pojemność" value={value.capacityKwh} unit="kWh" onChange={(capacityKwh) => update({ capacityKwh })} />
        <NumberField label="Cena zakupu netto" value={value.priceNet} unit="zł" onChange={(priceNet) => update({ priceNet })} />
      </div>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-3 text-sm font-bold text-violet-800 dark:text-violet-200">
        <input type="checkbox" checked={showDetails} onChange={(event) => setShowDetails(event.target.checked)} className="h-4 w-4 accent-violet-600" />
        Dodatkowe informacje o sprzęcie
      </label>
      {showDetails ? (
        <div className={detailsClass}>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Napięcie baterii</span>
              <select className={inputClass} value={value.voltageType} onChange={(event) => update({ voltageType: event.target.value as CustomStorageEquipment["voltageType"] })}>
                <option value="low_voltage">LV — niskonapięciowy</option>
                <option value="high_voltage">HV — wysokonapięciowy</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-200 sm:mt-7">
              <input type="checkbox" checked={value.isEu} onChange={(event) => update({ isEu: event.target.checked })} className="h-4 w-4 accent-violet-600" />
              Produkt europejski / kwalifikuje bonus UE
            </label>
          </div>
          <WarrantyFields value={value} update={update} />
        </div>
      ) : null}
    </div>
  );
}

export function CustomInverterFields({
  value,
  onChange,
  onInvalidate,
}: CommonProps<CustomInverterEquipment>) {
  const [showDetails, setShowDetails] = useState(false);

  function update(changes: Partial<CustomInverterEquipment>) {
    onChange({ ...value, ...changes });
    onInvalidate();
  }

  return (
    <div className="mb-5 rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-4 dark:border-violet-500/50 dark:bg-violet-950/20">
      <div className="mb-4 font-black text-violet-800 dark:text-violet-200">Falownik niestandardowy</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nazwa wyświetlana</span>
          <input className={inputClass} type="text" placeholder="Pełna nazwa falownika" value={value.displayName} onChange={(event) => update({ displayName: event.target.value })} />
        </label>
        <NumberField label="Moc / maks. moc instalacji" value={value.maxPvKw} unit="kW" onChange={(maxPvKw) => update({ maxPvKw })} />
        <NumberField label="Cena zakupu netto" value={value.priceNet} unit="zł" onChange={(priceNet) => update({ priceNet })} />
      </div>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-3 text-sm font-bold text-violet-800 dark:text-violet-200">
        <input type="checkbox" checked={showDetails} onChange={(event) => setShowDetails(event.target.checked)} className="h-4 w-4 accent-violet-600" />
        Dodatkowe informacje o sprzęcie
      </label>
      {showDetails ? (
        <div className={detailsClass}>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Typ falownika</span>
              <select className={inputClass} value={value.type} onChange={(event) => update({ type: event.target.value as CustomInverterEquipment["type"] })}>
                <option value="hybrid">Hybrydowy</option>
                <option value="ongrid">Sieciowy</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Napięcie baterii</span>
              <select className={inputClass} value={value.batteryVoltageType} disabled={value.type !== "hybrid"} onChange={(event) => update({ batteryVoltageType: event.target.value as CustomInverterEquipment["batteryVoltageType"] })}>
                <option value="low_voltage">LV — niskonapięciowy</option>
                <option value="high_voltage">HV — wysokonapięciowy</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-200 sm:mt-7">
              <input type="checkbox" checked={value.hasEms} onChange={(event) => update({ hasEms: event.target.checked })} className="h-4 w-4 accent-violet-600" />
              Obsługuje EMS
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-200 sm:mt-7">
              <input type="checkbox" checked={value.isEu} onChange={(event) => update({ isEu: event.target.checked })} className="h-4 w-4 accent-violet-600" />
              Produkt europejski
            </label>
          </div>
          <WarrantyFields value={value} update={update} />
        </div>
      ) : null}
    </div>
  );
}
