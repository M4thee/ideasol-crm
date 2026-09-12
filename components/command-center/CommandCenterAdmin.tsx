"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import type {
  CommandCenterDashboardRow,
  CommandCenterDeviceRow,
  CommandCenterPage,
  CommandCenterPeriod,
  CommandCenterRadioStationRow,
  CommandCenterSnapshot,
  CommandCenterWidget,
} from "@/lib/command-center/types";
import { VISIBLE_COMMAND_CENTER_WIDGETS, createWidget } from "@/lib/command-center/widget-registry";
import CommandCenterCanvas, { EMPTY_COMMAND_CENTER_METRICS } from "./CommandCenterCanvas";

type AdminTab = "dashboards" | "widgets" | "devices" | "radio" | "settings";
type VersionRow = { id: string; dashboard_id: string; version_number: number; published_at: string };
type AdminData = {
  dashboards: CommandCenterDashboardRow[];
  versions: VersionRow[];
  devices: CommandCenterDeviceRow[];
  stations: CommandCenterRadioStationRow[];
};
type DeviceActivation = { code: string; deviceName: string; expiresAt: string };

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: "dashboards", label: "Dashboardy" },
  { id: "widgets", label: "Widżety" },
  { id: "devices", label: "Urządzenia" },
  { id: "radio", label: "Radio" },
  { id: "settings", label: "Ustawienia" },
];

function cloneSnapshot(snapshot: CommandCenterSnapshot) {
  return structuredClone(snapshot);
}

function isOverlapping(a: CommandCenterWidget, b: CommandCenterWidget) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function placeWidget(page: CommandCenterPage, widget: CommandCenterWidget) {
  for (let y = 0; y <= 8 - widget.h; y += 1) {
    for (let x = 0; x <= 12 - widget.w; x += 1) {
      const candidate = { ...widget, x, y };
      if (!page.widgets.some((existing) => isOverlapping(candidate, existing))) return candidate;
    }
  }
  return null;
}

type PreviewCanvasProps = {
  dashboardName: string;
  page: CommandCenterPage;
  selectedWidgetId: string | null;
  onLibraryDrop: (kind: string) => void;
  onSelectWidget: (widgetId: string) => void;
  onWidgetDrop: (sourceWidgetId: string, targetWidgetId: string) => void;
};

function FittedPreviewCanvas({
  dashboardName,
  page,
  selectedWidgetId,
  onLibraryDrop,
  onSelectWidget,
  onWidgetDrop,
}: PreviewCanvasProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const resize = () => {
      setScale(Math.min(frame.clientWidth / 1920, frame.clientHeight / 1080));
    };
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="relative h-full w-full overflow-hidden bg-black">
      <div
        style={{
          height: 1080,
          left: "50%",
          position: "absolute",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center",
          width: 1920,
        }}
      >
        <CommandCenterCanvas
          dashboardName={dashboardName}
          editing
          metrics={EMPTY_COMMAND_CENTER_METRICS}
          onLibraryDrop={onLibraryDrop}
          onSelectWidget={onSelectWidget}
          onWidgetDrop={onWidgetDrop}
          page={page}
          selectedWidgetId={selectedWidgetId}
          theme="dark"
        />
      </div>
    </div>
  );
}

export default function CommandCenterAdmin() {
  const [tab, setTab] = useState<AdminTab>("dashboards");
  const [data, setData] = useState<AdminData>({ dashboards: [], versions: [], devices: [], stations: [] });
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CommandCenterSnapshot | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ładowanie…");
  const [error, setError] = useState("");
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [deviceActivation, setDeviceActivation] = useState<DeviceActivation | null>(null);

  const selectedDashboard = data.dashboards.find((dashboard) => dashboard.id === selectedDashboardId) || null;
  const page = draft?.pages.find((item) => item.id === pageId) || draft?.pages[0] || null;
  const selectedWidget = page?.widgets.find((widget) => widget.id === selectedWidgetId) || null;
  const versions = data.versions.filter((version) => version.dashboard_id === selectedDashboardId);

  const api = useCallback(async (body?: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    const response = await fetch("/api/command-center/admin", {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Operacja nie powiodła się.");
    return result;
  }, []);

  const reload = useCallback(async () => {
    setError("");
    try {
      const result = await api() as AdminData;
      setData(result);
      setSelectedDashboardId((current) => result.dashboards.some((item) => item.id === current && !item.archived_at)
        ? current
        : result.dashboards.find((item) => !item.archived_at)?.id || null);
      setStatus("Gotowe");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się załadować Command Center.");
      setStatus("");
    }
  }, [api]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [reload]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!selectedDashboard) {
        setDraft(null);
        return;
      }
      const nextDraft = cloneSnapshot(selectedDashboard.draft_snapshot);
      setDraft(nextDraft);
      setPageId(nextDraft.pages[0]?.id || null);
      setSelectedWidgetId(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedDashboardId, selectedDashboard]);

  useEffect(() => {
    if (!previewFullscreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewFullscreen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewFullscreen]);

  function updatePage(update: Partial<CommandCenterPage>) {
    if (!draft || !page) return;
    setDraft({ ...draft, pages: draft.pages.map((item) => item.id === page.id ? { ...item, ...update } : item) });
  }

  function updateWidget(update: Partial<CommandCenterWidget>) {
    if (!page || !selectedWidget) return;
    updatePage({ widgets: page.widgets.map((widget) => widget.id === selectedWidget.id ? { ...widget, ...update } : widget) });
  }

  function addWidget(definitionId: string) {
    if (!page) return;
    const nextWidget = placeWidget(page, createWidget(definitionId));
    if (!nextWidget) {
      setError("Na tym ekranie nie ma miejsca na widżet o domyślnym rozmiarze.");
      return;
    }
    updatePage({ widgets: [...page.widgets, nextWidget] });
    setSelectedWidgetId(nextWidget.id);
  }

  function swapWidgets(sourceId: string, targetId: string) {
    if (!page || sourceId === targetId) return;
    const source = page.widgets.find((widget) => widget.id === sourceId);
    const target = page.widgets.find((widget) => widget.id === targetId);
    if (!source || !target) return;
    updatePage({ widgets: page.widgets.map((widget) => {
      if (widget.id === source.id) return { ...widget, x: target.x, y: target.y };
      if (widget.id === target.id) return { ...widget, x: source.x, y: source.y };
      return widget;
    }) });
  }

  async function perform(body: Record<string, unknown>, message: string) {
    setStatus(message);
    setError("");
    try {
      const result = await api(body);
      if (result.activationCode && result.activationExpiresAt) {
        setDeviceActivation({
          code: result.activationCode,
          deviceName: result.device?.name || "Urządzenie",
          expiresAt: result.activationExpiresAt,
        });
      }
      await reload();
      setStatus("Gotowe");
      return result;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operacja nie powiodła się.");
      setStatus("");
      return null;
    }
  }

  async function createDashboard() {
    const result = await perform({ action: "create-dashboard", name: "Nowy Command Center" }, "Tworzenie dashboardu…");
    if (result?.dashboard?.id) setSelectedDashboardId(result.dashboard.id);
  }

  async function saveDraft(publish = false) {
    if (!selectedDashboard || !draft) return;
    await perform({ action: publish ? "publish" : "save-draft", dashboardId: selectedDashboard.id, snapshot: draft }, publish ? "Walidacja i publikacja…" : "Zapisywanie draftu…");
  }

  async function rollback(versionId: string) {
    if (!selectedDashboard) return;
    await perform({ action: "rollback", dashboardId: selectedDashboard.id, versionId }, "Przywracanie i publikowanie wersji…");
  }

  function addPage() {
    if (!draft) return;
    const id = `page-${crypto.randomUUID()}`;
    const nextPage: CommandCenterPage = { id, name: `Ekran ${draft.pages.length + 1}`, enabled: true, order: draft.pages.length, rotationSeconds: 30, widgets: [] };
    setDraft({ ...draft, pages: [...draft.pages, nextPage] });
    setPageId(id);
    setSelectedWidgetId(null);
  }

  function movePage(direction: -1 | 1) {
    if (!draft || !page) return;
    const ordered = [...draft.pages].sort((a, b) => a.order - b.order);
    const currentIndex = ordered.findIndex((item) => item.id === page.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
    setDraft({ ...draft, pages: ordered.map((item, order) => ({ ...item, order })) });
  }

  function deletePage() {
    if (!draft || !page || draft.pages.length <= 1) return;
    const remaining = draft.pages
      .filter((item) => item.id !== page.id)
      .sort((a, b) => a.order - b.order)
      .map((item, order) => ({ ...item, order }));
    setDraft({ ...draft, pages: remaining });
    setPageId(remaining[0]?.id || null);
    setSelectedWidgetId(null);
  }

  const dashboardHeader = selectedDashboard && draft && page ? (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-3"><h2 className="text-lg font-black">{selectedDashboard.name}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selectedDashboard.published_version_id ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{selectedDashboard.published_version_id ? `Opublikowany · ${versions[0]?.version_number || 1}` : "Tylko draft"}</span></div>
          <p className="mt-1 text-xs text-slate-500">Zmiany w builderze nie trafiają na telewizory przed publikacją.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void saveDraft(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Zapisz draft</button>
          <button onClick={() => void saveDraft(true)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white hover:bg-emerald-400">Zapisz i opublikuj</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        {[...draft.pages].sort((a, b) => a.order - b.order).map((item) => <button key={item.id} onClick={() => { setPageId(item.id); setSelectedWidgetId(null); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${item.id === page.id ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{item.enabled ? "●" : "○"} {item.name}</button>)}
        <button onClick={addPage} className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500">+ Ekran</button>
      </div>
    </>
  ) : null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-black uppercase tracking-[0.18em] text-sky-600">IdeaSol</p><h1 className="mt-1 text-3xl font-black tracking-tight">Command Center</h1><p className="mt-1 text-sm text-slate-500">Silnik dashboardów zarządczych — TV-first</p></div>
          <div className="text-right text-xs text-slate-500"><span>{status}</span>{error && <p className="mt-1 font-bold text-red-600">{error}</p>}</div>
        </div>

        <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === item.id ? "bg-slate-900 text-white dark:bg-sky-500" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{item.label}</button>)}
        </nav>

        {tab === "dashboards" && (
          <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button onClick={() => void createDashboard()} className="mb-3 w-full rounded-xl bg-sky-500 px-3 py-2.5 text-sm font-black text-white">+ Nowy dashboard</button>
              <div className="space-y-2">{data.dashboards.filter((item) => !item.archived_at).map((item) => <button key={item.id} onClick={() => setSelectedDashboardId(item.id)} className={`w-full rounded-xl border px-3 py-3 text-left ${item.id === selectedDashboardId ? "border-sky-400 bg-sky-50 dark:bg-sky-950/30" : "border-slate-200 dark:border-slate-700"}`}><strong className="block text-sm">{item.name}</strong><span className="mt-1 block text-[11px] text-slate-500">{item.published_version_id ? "Wersja opublikowana" : "Nieopublikowany"}</span></button>)}</div>
              {selectedDashboard && <div className="mt-4 grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-700"><button onClick={() => void perform({ action: "duplicate-dashboard", dashboardId: selectedDashboard.id }, "Duplikowanie…")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">Duplikuj</button><button onClick={() => { if (window.confirm("Archiwizować ten dashboard? Przypisane urządzenia muszą być wcześniej odłączone.")) void perform({ action: "archive-dashboard", dashboardId: selectedDashboard.id }, "Archiwizowanie…"); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Archiwizuj</button></div>}
            </aside>

            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {dashboardHeader}
              {selectedDashboard && draft && page ? (
                <div className="grid min-h-[720px] lg:grid-cols-[210px_minmax(0,1fr)_240px]">
                  <aside className="border-r border-slate-200 p-3 dark:border-slate-700"><p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Biblioteka</p><div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">{VISIBLE_COMMAND_CENTER_WIDGETS.map((definition) => <button draggable onDragStart={(event) => event.dataTransfer.setData("application/x-cc-widget-kind", definition.id)} onClick={() => addWidget(definition.id)} key={definition.id} className="w-full cursor-grab rounded-xl border border-slate-200 p-3 text-left hover:border-sky-400 dark:border-slate-700"><strong className="block text-xs">{definition.name}</strong><span className="mt-1 block text-[10px] leading-snug text-slate-500">{definition.description}</span></button>)}</div></aside>
                  <div className="min-w-0 bg-slate-200/60 p-4 dark:bg-slate-950/60">
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
                      <FittedPreviewCanvas dashboardName={selectedDashboard.name} onLibraryDrop={addWidget} onSelectWidget={setSelectedWidgetId} onWidgetDrop={swapWidgets} page={page} selectedWidgetId={selectedWidgetId} />
                      <button type="button" onClick={() => setPreviewFullscreen(true)} className="absolute right-3 top-3 z-10 rounded-lg border border-white/20 bg-slate-950/85 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur hover:bg-sky-600">Pełny podgląd</button>
                    </div>
                    <p className="mt-3 text-center text-[11px] text-slate-500">Logiczna plansza 1920×1080 · ten sam układ skaluje się do 4K</p>
                  </div>
                  <aside className="border-l border-slate-200 p-4 dark:border-slate-700">
                    {selectedWidget ? <WidgetSettings widget={selectedWidget} onChange={updateWidget} onDelete={() => { updatePage({ widgets: page.widgets.filter((widget) => widget.id !== selectedWidget.id) }); setSelectedWidgetId(null); }} onDuplicate={() => { const copy = placeWidget(page, { ...selectedWidget, id: `${selectedWidget.kind}-${crypto.randomUUID()}`, title: `${selectedWidget.title} — kopia` }); if (!copy) { setError("Na tym ekranie nie ma miejsca na kopię widżetu."); return; } updatePage({ widgets: [...page.widgets, copy] }); setSelectedWidgetId(copy.id); }} /> : <PageSettings canDelete={draft.pages.length > 1} onChange={updatePage} onDelete={deletePage} onMove={movePage} page={page} />}
                  </aside>
                </div>
              ) : <div className="p-12 text-center text-slate-500">Utwórz pierwszy dashboard, aby rozpocząć.</div>}
            </section>
          </div>
        )}

        {tab === "widgets" && <SimplePanel title="Biblioteka widżetów" subtitle="MVP zawiera wyłącznie metryki możliwe do policzenia z zarejestrowanych danych CRM."><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{VISIBLE_COMMAND_CENTER_WIDGETS.map((item) => <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" key={item.id}><strong>{item.name}</strong><p className="mt-2 text-sm text-slate-500">{item.description}</p><span className="mt-3 block text-xs text-slate-400">Domyślnie {item.defaultSize.w}×{item.defaultSize.h}</span></div>)}</div></SimplePanel>}
        {tab === "devices" && <DevicesPanel activation={deviceActivation} dashboards={data.dashboards} devices={data.devices} stations={data.stations} onCreate={(name, platform, dashboardId) => void perform({ action: "create-device", name, platform, dashboardId }, "Rejestrowanie urządzenia…")} onIssueCode={(deviceId) => void perform({ action: "create-device-activation-code", deviceId }, "Generowanie kodu aktywacyjnego…")} onUpdate={(deviceId, field, value) => void perform({ action: "update-device", deviceId, [field]: value }, "Zapisywanie urządzenia…")} />}
        {tab === "radio" && <RadioPanel stations={data.stations} onCreate={(name, streamUrl, homepageUrl) => void perform({ action: "create-station", name, streamUrl, homepageUrl }, "Dodawanie stacji…")} onToggle={(stationId, isActive) => void perform({ action: "update-station", stationId, isActive }, "Zapisywanie stacji…")} />}
        {tab === "settings" && <div className="space-y-5">{selectedDashboard ? <DashboardSettingsPanel dashboard={selectedDashboard} key={selectedDashboard.id} versions={versions} onRollback={(versionId) => void rollback(versionId)} onUpdate={(name, description, defaultRotationSeconds) => void perform({ action: "update-dashboard", dashboardId: selectedDashboard.id, name, description, defaultRotationSeconds }, "Zapisywanie ustawień dashboardu…")} /> : <SimplePanel title="Ustawienia dashboardu" subtitle="Najpierw utwórz lub wybierz dashboard."><p className="text-sm text-slate-500">Brak aktywnego dashboardu.</p></SimplePanel>}<SimplePanel title="Niezawodność i definicje" subtitle="Command Center pozostaje warstwą odczytową nad CRM."><div className="grid gap-4 md:grid-cols-2"><InfoCard title="Prywatność" text="TV otrzymuje wyłącznie agregaty. API urządzenia nie zwraca nazw, telefonów, adresów ani innych danych klientów." /><InfoCard title="Odświeżanie" text="Urządzenie sprawdza wersję i dane co 15 sekund; strony rotują domyślnie co 30 sekund." /><InfoCard title="Podejmowalność" text="To udział leadów z co najmniej jedną ręcznie zarejestrowaną aktywnością, a nie liczba połączeń." /><InfoCard title="Radio" text="Stacja, głośność i autoplay są ustawieniami konkretnego urządzenia. Lista nie zawiera zgadywanych adresów streamów." /></div></SimplePanel></div>}
      </div>
      {previewFullscreen && selectedDashboard && page && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-label="Pełny podgląd dashboardu" aria-modal="true">
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/15 bg-slate-950 px-5 text-white">
            <div><strong className="block text-sm">{selectedDashboard.name}</strong><span className="text-xs text-slate-400">{page.name} · podgląd 1920×1080</span></div>
            <button type="button" autoFocus onClick={() => setPreviewFullscreen(false)} className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-sky-100">Zamknij podgląd</button>
          </div>
          <div className="min-h-0 flex-1">
            <FittedPreviewCanvas dashboardName={selectedDashboard.name} onLibraryDrop={addWidget} onSelectWidget={setSelectedWidgetId} onWidgetDrop={swapWidgets} page={page} selectedWidgetId={selectedWidgetId} />
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>{children}</label>; }
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-800";

function PageSettings({ canDelete, page, onChange, onDelete, onMove }: { canDelete: boolean; page: CommandCenterPage; onChange: (value: Partial<CommandCenterPage>) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  return <div className="space-y-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Ustawienia ekranu</p><Field label="Nazwa"><input className={inputClass} value={page.name} onChange={(event) => onChange({ name: event.target.value })} /></Field><Field label="Rotacja (sekundy)"><input className={inputClass} type="number" min={10} max={3600} value={page.rotationSeconds} onChange={(event) => onChange({ rotationSeconds: Number(event.target.value) })} /></Field><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={page.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} />Ekran aktywny</label><div className="grid grid-cols-2 gap-2"><button onClick={() => onMove(-1)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-bold dark:border-slate-600">← Wcześniej</button><button onClick={() => onMove(1)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-bold dark:border-slate-600">Później →</button></div><button disabled={!canDelete} onClick={onDelete} className="w-full rounded-lg border border-red-200 px-2 py-2 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40">Usuń ekran</button><p className="text-xs leading-relaxed text-slate-500">Zmiana kolejności i usunięcie pozostają w drafcie do czasu publikacji. Zaznacz widżet na podglądzie, aby edytować jego parametry.</p></div>;
}

function WidgetSettings({ widget, onChange, onDelete, onDuplicate }: { widget: CommandCenterWidget; onChange: (value: Partial<CommandCenterWidget>) => void; onDelete: () => void; onDuplicate: () => void }) {
  return <div className="space-y-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Ustawienia widżetu</p><Field label="Tytuł"><input className={inputClass} value={widget.title} onChange={(event) => onChange({ title: event.target.value })} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Kolumna"><input className={inputClass} type="number" min={1} max={12 - widget.w + 1} value={widget.x + 1} onChange={(event) => onChange({ x: Math.max(0, Math.min(12 - widget.w, Number(event.target.value) - 1)) })} /></Field><Field label="Wiersz"><input className={inputClass} type="number" min={1} max={8 - widget.h + 1} value={widget.y + 1} onChange={(event) => onChange({ y: Math.max(0, Math.min(8 - widget.h, Number(event.target.value) - 1)) })} /></Field><Field label="Szerokość"><input className={inputClass} type="number" min={2} max={12 - widget.x} value={widget.w} onChange={(event) => onChange({ w: Math.max(2, Math.min(12 - widget.x, Number(event.target.value))) })} /></Field><Field label="Wysokość"><input className={inputClass} type="number" min={1} max={8 - widget.y} value={widget.h} onChange={(event) => onChange({ h: Math.max(1, Math.min(8 - widget.y, Number(event.target.value))) })} /></Field></div>{["leads-kpi", "sales-kpi", "sales-value", "meetings-kpi", "calls-kpi", "lead-map"].includes(widget.kind) && <Field label="Okres"><select className={inputClass} value={widget.config.period || "month"} onChange={(event) => onChange({ config: { ...widget.config, period: event.target.value as CommandCenterPeriod } })}><option value="today">Dzień</option><option value="week">Tydzień</option><option value="month">Miesiąc</option><option value="quarter">Kwartał</option></select></Field>}{widget.kind === "advisor-ranking" && <Field label="Kryterium"><select className={inputClass} value={widget.config.rankingMetric || "salesValue"} onChange={(event) => onChange({ config: { ...widget.config, rankingMetric: event.target.value as "sales" | "salesValue" | "contactRate" | "conversion" } })}><option value="salesValue">Wartość sprzedaży</option><option value="sales">Liczba sprzedaży</option><option value="contactRate">Podejmowalność</option><option value="conversion">Konwersja lead → sprzedaż</option></select></Field>}{widget.kind === "monthly-target" && <Field label="Cel miesięczny (PLN)"><input className={inputClass} type="number" min={0} value={widget.config.targetAmount || 0} onChange={(event) => onChange({ config: { ...widget.config, targetAmount: Number(event.target.value) } })} /></Field>}<div className="grid grid-cols-2 gap-2 pt-2"><button onClick={onDuplicate} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-bold dark:border-slate-600">Duplikuj</button><button onClick={onDelete} className="rounded-lg border border-red-200 px-2 py-2 text-xs font-bold text-red-600">Usuń</button></div></div>;
}

function DashboardSettingsPanel({ dashboard, versions, onRollback, onUpdate }: { dashboard: CommandCenterDashboardRow; versions: VersionRow[]; onRollback: (versionId: string) => void; onUpdate: (name: string, description: string | null, defaultRotationSeconds: number) => void }) {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description || "");
  const [rotation, setRotation] = useState(dashboard.default_rotation_seconds);
  return (
    <SimplePanel title="Ustawienia dashboardu" subtitle="Metadane dashboardu i historia opublikowanych wersji.">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <Field label="Nazwa"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Opis"><textarea className={`${inputClass} min-h-24 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="Domyślna rotacja (sekundy)"><input className={inputClass} type="number" min={10} max={3600} value={rotation} onChange={(event) => setRotation(Number(event.target.value))} /></Field>
          <button onClick={() => onUpdate(name, description.trim() || null, rotation)} className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-black text-white">Zapisz ustawienia</button>
        </div>
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Historia publikacji</p>
          {versions.length ? <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{versions.map((version, index) => <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div><strong className="block text-sm">Wersja {version.version_number}</strong><span className="text-xs text-slate-500">{new Date(version.published_at).toLocaleString("pl-PL")}</span></div>{index === 0 ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Aktualna</span> : <button onClick={() => { if (window.confirm(`Przywrócić wersję ${version.version_number}? Zostanie opublikowana jako nowa wersja.`)) onRollback(version.id); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-600">Przywróć</button>}</div>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Dashboard nie był jeszcze publikowany.</p>}
        </div>
      </div>
    </SimplePanel>
  );
}

function SimplePanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-black">{title}</h2><p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>{children}</section>; }
function InfoCard({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><strong>{title}</strong><p className="mt-2 text-sm leading-relaxed text-slate-500">{text}</p></div>; }

function ActivationCodeCard({ activation }: { activation: DeviceActivation }) {
  const [secondsLeft, setSecondsLeft] = useState(180);

  useEffect(() => {
    const updateCountdown = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(activation.expiresAt).getTime() - Date.now()) / 1000)));
    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [activation.expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  return (
    <div className={`mb-5 rounded-2xl border p-5 text-center ${secondsLeft ? "border-sky-300 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100" : "border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800"}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em]">Kod aktywacyjny · {activation.deviceName}</p>
      <code className="mt-3 block font-mono text-4xl font-black tracking-[0.16em] sm:text-5xl">{activation.code}</code>
      <p className="mt-3 text-sm font-bold">{secondsLeft ? `Ważny jeszcze ${minutes}:${seconds}` : "Kod wygasł — wygeneruj nowy."}</p>
      <p className="mt-1 text-xs opacity-70">Kod jest jednorazowy. Po aktywacji sesja na telewizorze pozostaje zapisana.</p>
    </div>
  );
}

function DevicesPanel({ activation, dashboards, devices, stations, onCreate, onIssueCode, onUpdate }: { activation: DeviceActivation | null; dashboards: CommandCenterDashboardRow[]; devices: CommandCenterDeviceRow[]; stations: CommandCenterRadioStationRow[]; onCreate: (name: string, platform: string, dashboardId: string | null) => void; onIssueCode: (id: string) => void; onUpdate: (id: string, field: string, value: unknown) => void }) {
  const [name, setName] = useState("TV — Biuro");
  const [platform, setPlatform] = useState("google_tv");
  const [dashboardId, setDashboardId] = useState("");
  return <SimplePanel title="Urządzenia" subtitle="Jeden APK obsługuje wszystkie ekrany. Każdy ekran ma własny dashboard, motyw, harmonogram i radio.">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30"><div><strong className="text-sm">Uniwersalna aplikacja Google TV</strong><p className="mt-1 text-xs text-slate-500">Na telewizorze wpisz w Downloaderze: crm.ideasol.pl/cc.apk</p></div><a className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-black text-white" download href="/cc.apk">Pobierz APK</a></div>
    {activation && <ActivationCodeCard activation={activation} />}
    <div className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800 md:grid-cols-[1fr_180px_1fr_auto]"><input aria-label="Nazwa nowego urządzenia" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /><select aria-label="Platforma nowego urządzenia" className={inputClass} value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="browser">Przeglądarka</option><option value="android_tv">Android TV</option><option value="google_tv">Google TV</option><option value="apple_tv">Apple TV</option><option value="fire_tv">Fire TV</option><option value="other">Inne</option></select><select aria-label="Dashboard nowego urządzenia" className={inputClass} value={dashboardId} onChange={(event) => setDashboardId(event.target.value)}><option value="">Bez dashboardu</option>{dashboards.filter((item) => !item.archived_at).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={() => onCreate(name, platform, dashboardId || null)} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white">Zarejestruj i pokaż kod</button></div>
    <div className="space-y-4">{devices.map((device) => { const isOnline = Boolean(device.is_online); return <article key={device.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><input aria-label={`Nazwa urządzenia ${device.name}`} className="border-0 bg-transparent p-0 text-base font-black outline-none" defaultValue={device.name} onBlur={(event) => { const value = event.target.value.trim(); if (value && value !== device.name) onUpdate(device.id, "name", value); }} /><span className={`mt-1 block text-xs font-bold ${isOnline ? "text-emerald-600" : "text-slate-500"}`}>{isOnline ? "● Online" : device.last_seen_at ? `Offline · ${new Date(device.last_seen_at).toLocaleString("pl-PL")}` : "Jeszcze nieaktywowane"}</span></div><button onClick={() => onIssueCode(device.id)} className="rounded-lg border border-sky-300 px-3 py-2 text-xs font-bold text-sky-700 dark:text-sky-300">Wygeneruj kod aktywacyjny</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Dashboard"><select className={inputClass} value={device.dashboard_id || ""} onChange={(event) => onUpdate(device.id, "dashboardId", event.target.value || null)}><option value="">Bez dashboardu</option>{dashboards.filter((item) => !item.archived_at).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Platforma"><select className={inputClass} value={device.platform} onChange={(event) => onUpdate(device.id, "platform", event.target.value)}><option value="browser">Przeglądarka</option><option value="android_tv">Android TV</option><option value="google_tv">Google TV</option><option value="apple_tv">Apple TV</option><option value="fire_tv">Fire TV</option><option value="other">Inne</option></select></Field><Field label="Motyw"><select className={inputClass} value={device.theme} onChange={(event) => onUpdate(device.id, "theme", event.target.value)}><option value="light">Jasny</option><option value="dark">Ciemny</option><option value="auto">Auto</option></select></Field><Field label="Strefa czasowa"><select className={inputClass} value={device.timezone} onChange={(event) => onUpdate(device.id, "timezone", event.target.value)}>{!["Europe/Warsaw", "Europe/London", "UTC"].includes(device.timezone) && <option value={device.timezone}>{device.timezone}</option>}<option value="Europe/Warsaw">Europe/Warsaw</option><option value="Europe/London">Europe/London</option><option value="UTC">UTC</option></select></Field><Field label="Tryb ciemny od"><input className={inputClass} defaultValue={device.auto_dark_from} min={0} max={23} type="number" onBlur={(event) => onUpdate(device.id, "autoDarkFrom", Number(event.target.value))} /></Field><Field label="Tryb jasny od"><input className={inputClass} defaultValue={device.auto_light_from} min={0} max={23} type="number" onBlur={(event) => onUpdate(device.id, "autoLightFrom", Number(event.target.value))} /></Field><Field label="Radio"><select className={inputClass} value={device.radio_station_id || ""} onChange={(event) => onUpdate(device.id, "radioStationId", event.target.value || null)}><option value="">Radio wyłączone</option>{stations.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Głośność 0–100"><input className={inputClass} defaultValue={device.radio_volume} min={0} max={100} type="number" onBlur={(event) => onUpdate(device.id, "radioVolume", Number(event.target.value))} /></Field></div><label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={device.radio_autoplay} onChange={(event) => onUpdate(device.id, "radioAutoplay", event.target.checked)} />Uruchamiaj radio automatycznie, jeśli platforma na to pozwala</label></article>; })}</div>
  </SimplePanel>;
}

function RadioPanel({ stations, onCreate, onToggle }: { stations: CommandCenterRadioStationRow[]; onCreate: (name: string, streamUrl: string, homepageUrl: string) => void; onToggle: (id: string, active: boolean) => void }) {
  const [name, setName] = useState(""); const [streamUrl, setStreamUrl] = useState(""); const [homepageUrl, setHomepageUrl] = useState("");
  return <SimplePanel title="Radio internetowe" subtitle="Dodaj wyłącznie oficjalny lub licencjonowany adres HTTPS nadawcy."><div className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800 md:grid-cols-[180px_1fr_1fr_auto]"><input className={inputClass} placeholder="Nazwa stacji" value={name} onChange={(event) => setName(event.target.value)} /><input className={inputClass} placeholder="https://…/stream" value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} /><input className={inputClass} placeholder="Strona stacji (opcjonalnie)" value={homepageUrl} onChange={(event) => setHomepageUrl(event.target.value)} /><button onClick={() => onCreate(name, streamUrl, homepageUrl)} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white">Dodaj</button></div><div className="space-y-2">{stations.map((station) => <div key={station.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div><strong>{station.name}</strong><span className="mt-1 block break-all text-xs text-slate-500">{station.stream_url}</span></div><button onClick={() => onToggle(station.id, !station.is_active)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${station.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{station.is_active ? "Aktywna" : "Wyłączona"}</button></div>)}</div></SimplePanel>;
}
