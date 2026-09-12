"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CommandCenterDevicePayload,
  CommandCenterLiveEvent,
  CommandCenterLiveEventsPayload,
} from "@/lib/command-center/types";
import CommandCenterCanvas from "./CommandCenterCanvas";

const COMMAND_CENTER_ACHIEVEMENT_ART = "/animations/command-center-achievement.webp";
const COMMAND_CENTER_ACHIEVEMENT_AUDIO = "/animations/command-center-achievement.m4a";

function resolveTheme(payload: CommandCenterDevicePayload, date: Date) {
  if (payload.device.theme !== "auto") return payload.device.theme;
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: payload.device.timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  const darkFrom = payload.device.auto_dark_from;
  const lightFrom = payload.device.auto_light_from;
  if (darkFrom > lightFrom) return hour >= darkFrom || hour < lightFrom ? "dark" : "light";
  return hour >= darkFrom && hour < lightFrom ? "dark" : "light";
}

function DeviceActivation({ onActivated }: { onActivated: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function activate() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/command-center/device/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się aktywować ekranu.");
      await onActivated();
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Nie udało się aktywować ekranu.");
    } finally {
      setSubmitting(false);
    }
  }

  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const displayCode = normalizedCode.length > 4
    ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`
    : normalizedCode;

  return (
    <main className="flex h-dvh w-dvw items-center justify-center overflow-hidden bg-[#071522] p-12 text-white">
      <div className="w-full max-w-3xl rounded-[36px] border border-sky-400/25 bg-[#0d2335] p-12 text-center shadow-2xl">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-sky-400">IdeaSol Command Center</p>
        <h1 className="mt-5 text-5xl font-black tracking-tight">Aktywuj ten ekran</h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed text-slate-300">W panelu administratora wybierz urządzenie, wygeneruj kod i wpisz go poniżej. Kod działa przez 3 minuty i można go wykorzystać tylko raz.</p>
        <form className="mx-auto mt-9 max-w-xl" onSubmit={(event) => { event.preventDefault(); void activate(); }}>
          <input
            aria-label="Kod aktywacyjny"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            autoFocus
            className="w-full rounded-2xl border-2 border-slate-600 bg-slate-950 px-6 py-5 text-center font-mono text-5xl font-black tracking-[0.18em] text-white outline-none transition focus:border-sky-400"
            inputMode="text"
            maxLength={9}
            placeholder="ABCD-EFGH"
            value={displayCode}
            onChange={(event) => setCode(event.target.value)}
          />
          {error && <p className="mt-4 rounded-xl bg-red-950/70 px-4 py-3 text-lg font-bold text-red-200">{error}</p>}
          <button disabled={normalizedCode.length !== 8 || submitting} className="mt-6 w-full rounded-2xl bg-sky-500 px-6 py-4 text-2xl font-black text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40" type="submit">{submitting ? "Aktywowanie…" : "Aktywuj ekran"}</button>
        </form>
        <p className="mt-7 text-sm text-slate-500">Po aktywacji sesja zostanie zapisana na tym telewizorze.</p>
      </div>
    </main>
  );
}

function LiveEventAlert({ event, exiting }: { event: CommandCenterLiveEvent; exiting: boolean }) {
  const notificationAudioRef = useRef<HTMLAudioElement>(null);
  const isSale = event.kind === "sale";
  const value = isSale && event.value
    ? new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(event.value)
    : null;

  useEffect(() => {
    const audio = notificationAudioRef.current;
    if (!audio) return;
    audio.volume = 0.62;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Brak dźwięku nie może zatrzymać ani zasłonić animacji na starszym WebView.
    });
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [event.id]);

  return (
    <div className="cc-live-event-layer" aria-live="polite" role="status">
      <div className={`cc-live-event-card cc-live-event-${event.kind} ${exiting ? "cc-live-event-exiting" : "cc-live-event-entering"}`}>
        {/* Zwykły obraz animowany: Android TV nie może nałożyć na niego natywnego przycisku Play. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          aria-hidden="true"
          className="cc-live-event-art"
          src={COMMAND_CENTER_ACHIEVEMENT_ART}
        />
        <audio
          aria-hidden="true"
          preload="auto"
          ref={notificationAudioRef}
          src={COMMAND_CENTER_ACHIEVEMENT_AUDIO}
        />
        <div className="cc-live-event-copy">
          <span>Nowe zdarzenie w CRM</span>
          <strong>{isSale ? "Nowa sprzedaż!" : "Nowy lead!"}</strong>
          <small>{value ? `Wartość sprzedaży: ${value}` : "Nowa szansa trafiła do CRM"}</small>
        </div>
      </div>
    </div>
  );
}

export default function CommandCenterTv({ token, buildVersion }: { token?: string; buildVersion: string }) {
  const [payload, setPayload] = useState<CommandCenterDevicePayload | null>(null);
  const [error, setError] = useState("");
  const [activationRequired, setActivationRequired] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(new Date());
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioVolumeOverride, setRadioVolumeOverride] = useState<number | null>(null);
  const [radioMenuOpen, setRadioMenuOpen] = useState(false);
  const [radioPreference, setRadioPreference] = useState<{ deviceId: string; stationId: string | null } | null>(null);
  const [activeLiveEvent, setActiveLiveEvent] = useState<CommandCenterLiveEvent | null>(null);
  const [liveEventExiting, setLiveEventExiting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const radioMenuRef = useRef<HTMLDivElement | null>(null);
  const radioPickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const resumeRadioAfterStationChangeRef = useRef(false);
  const autoplayAttemptedStationRef = useRef<string | null>(null);
  const liveEventCursorRef = useRef<string | null>(null);
  const seenLiveEventIdsRef = useRef(new Set<string>());
  const liveEventQueueRef = useRef<CommandCenterLiveEvent[]>([]);
  const liveEventActiveRef = useRef(false);
  const liveEventExitTimeoutRef = useRef<number | null>(null);
  const liveEventClearTimeoutRef = useRef<number | null>(null);
  const reloadRequestedRef = useRef(false);
  const activePages = useMemo(
    () => (payload?.snapshot.pages || []).filter((page) => page.enabled).sort((a, b) => a.order - b.order),
    [payload]
  );
  const availableRadioStations = useMemo(
    () => payload?.radioStations || (payload?.radioStation ? [payload.radioStation] : []),
    [payload?.radioStation, payload?.radioStations]
  );
  const radioPreferenceReady = Boolean(payload?.device.id && radioPreference?.deviceId === payload.device.id);
  const selectedRadioStation = useMemo(() => {
    if (!payload) return null;
    if (radioPreferenceReady && radioPreference?.stationId) {
      const selected = availableRadioStations.find((station) => station.id === radioPreference.stationId);
      if (selected) return selected;
    }
    return payload.radioStation || availableRadioStations[0] || null;
  }, [availableRadioStations, payload, radioPreference?.stationId, radioPreferenceReady]);

  const load = useCallback(async () => {
    try {
      const endpoint = token
        ? `/api/command-center/device/${encodeURIComponent(token)}`
        : "/api/command-center/device/current";
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!token && response.status === 401) {
        setPayload(null);
        setActivationRequired(true);
        setError("");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Nie udało się pobrać dashboardu.");
      if (
        !reloadRequestedRef.current
        && result.appVersion
        && result.appVersion !== buildVersion
      ) {
        reloadRequestedRef.current = true;
        const refreshedUrl = new URL(window.location.href);
        refreshedUrl.searchParams.set("ccv", result.appVersion.slice(0, 12));
        window.location.replace(refreshedUrl.toString());
        return;
      }
      setPayload((current) => {
        if (current && current.dashboard.versionId !== result.dashboard.versionId) setPageIndex(0);
        return result as CommandCenterDevicePayload;
      });
      setActivationRequired(false);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Brak połączenia z Command Center.");
    }
  }, [buildVersion, token]);

  const showNextLiveEvent = useCallback(function showNext() {
    if (liveEventActiveRef.current) return;
    const nextEvent = liveEventQueueRef.current.shift();
    if (!nextEvent) return;
    liveEventActiveRef.current = true;
    setActiveLiveEvent(nextEvent);
    setLiveEventExiting(false);
    liveEventExitTimeoutRef.current = window.setTimeout(() => setLiveEventExiting(true), 5_050);
    liveEventClearTimeoutRef.current = window.setTimeout(() => {
      setActiveLiveEvent(null);
      liveEventActiveRef.current = false;
      showNext();
    }, 6_100);
  }, []);

  const loadLiveEvents = useCallback(async () => {
    const baseEndpoint = token
      ? `/api/command-center/device/${encodeURIComponent(token)}/events`
      : "/api/command-center/device/events";
    const cursor = liveEventCursorRef.current;
    const endpoint = cursor ? `${baseEndpoint}?after=${encodeURIComponent(cursor)}` : baseEndpoint;
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as CommandCenterLiveEventsPayload;
      liveEventCursorRef.current = result.cursor;
      const unseen = result.events.filter((event) => {
        if (seenLiveEventIdsRef.current.has(event.id)) return false;
        seenLiveEventIdsRef.current.add(event.id);
        return true;
      });
      if (unseen.length) {
        liveEventQueueRef.current.push(...unseen);
        showNextLiveEvent();
      }
      if (seenLiveEventIdsRef.current.size > 1000) {
        seenLiveEventIdsRef.current = new Set(Array.from(seenLiveEventIdsRef.current).slice(-500));
      }
    } catch {
      // Główny dashboard działa dalej także przy chwilowym błędzie kanału powiadomień.
    }
  }, [showNextLiveEvent, token]);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void load(), 0);
    const refreshId = window.setInterval(() => void load(), 15_000);
    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(refreshId);
    };
  }, [load]);

  useEffect(() => {
    const image = document.createElement("img");
    image.src = COMMAND_CENTER_ACHIEVEMENT_ART;
    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.src = COMMAND_CENTER_ACHIEVEMENT_AUDIO;
    audio.load();
    return () => {
      image.removeAttribute("src");
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  useEffect(() => {
    if (!payload?.device.id) return;
    liveEventCursorRef.current = null;
    seenLiveEventIdsRef.current.clear();
    liveEventQueueRef.current = [];
    const initialEventsId = window.setTimeout(() => void loadLiveEvents(), 0);
    const liveEventsId = window.setInterval(() => void loadLiveEvents(), 4_000);
    return () => {
      window.clearTimeout(initialEventsId);
      window.clearInterval(liveEventsId);
    };
  }, [loadLiveEvents, payload?.device.id]);

  useEffect(() => {
    return () => {
      if (liveEventExitTimeoutRef.current) window.clearTimeout(liveEventExitTimeoutRef.current);
      if (liveEventClearTimeoutRef.current) window.clearTimeout(liveEventClearTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function resize() {
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const clockId = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(clockId);
  }, []);

  useEffect(() => {
    if (activePages.length < 2) return;
    const currentPage = activePages[pageIndex % activePages.length];
    const rotationId = window.setTimeout(
      () => setPageIndex((current) => (current + 1) % activePages.length),
      (currentPage?.rotationSeconds || payload?.dashboard.defaultRotationSeconds || 30) * 1000
    );
    return () => window.clearTimeout(rotationId);
  }, [activePages, pageIndex, payload?.dashboard.defaultRotationSeconds]);

  useEffect(() => {
    const deviceId = payload?.device.id;
    if (!deviceId) return;
    const storedStationId = window.localStorage.getItem(`cc-radio-station:${deviceId}`);
    const stationId = storedStationId && availableRadioStations.some((station) => station.id === storedStationId)
      ? storedStationId
      : null;
    setRadioPreference({ deviceId, stationId });
  }, [availableRadioStations, payload?.device.id]);

  useEffect(() => {
    if (!radioMenuOpen) return;
    const focusId = window.requestAnimationFrame(() => {
      const options = radioMenuRef.current?.querySelectorAll<HTMLButtonElement>("[data-radio-station]");
      const selectedIndex = availableRadioStations.findIndex((station) => station.id === selectedRadioStation?.id);
      options?.[Math.max(0, selectedIndex)]?.focus();
    });
    return () => window.cancelAnimationFrame(focusId);
  }, [availableRadioStations, radioMenuOpen, selectedRadioStation?.id]);

  const radioVolume = radioVolumeOverride ?? payload?.device.radio_volume ?? 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !payload?.device.id) return;
    const startVolume = audio.volume;
    const targetVolume = (radioVolume / 100) * (activeLiveEvent ? 0.15 : 1);
    const duration = activeLiveEvent ? 260 : 700;
    const startedAt = performance.now();
    let animationFrame = 0;
    const updateVolume = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = startVolume + (targetVolume - startVolume) * eased;
      if (progress < 1) animationFrame = window.requestAnimationFrame(updateVolume);
    };
    animationFrame = window.requestAnimationFrame(updateVolume);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeLiveEvent, payload?.device.id, radioVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    const stationId = selectedRadioStation?.id || null;
    if (!audio || !stationId || !radioPreferenceReady) return;
    audio.load();
    const shouldResume = resumeRadioAfterStationChangeRef.current;
    resumeRadioAfterStationChangeRef.current = false;
    const shouldAutoplay = payload?.device.radio_autoplay
      && autoplayAttemptedStationRef.current !== stationId;
    if (!shouldResume && !shouldAutoplay) {
      setRadioPlaying(false);
      return;
    }
    autoplayAttemptedStationRef.current = stationId;
    void audio.play()
      .then(() => setRadioPlaying(true))
      .catch(() => setRadioPlaying(false));
  }, [payload?.device.radio_autoplay, radioPreferenceReady, selectedRadioStation?.id]);

  function selectRadioStation(stationId: string) {
    const deviceId = payload?.device.id;
    if (!deviceId || stationId === selectedRadioStation?.id) {
      setRadioMenuOpen(false);
      radioPickerButtonRef.current?.focus();
      return;
    }
    resumeRadioAfterStationChangeRef.current = true;
    audioRef.current?.pause();
    setRadioPreference({ deviceId, stationId });
    window.localStorage.setItem(`cc-radio-station:${deviceId}`, stationId);
    setRadioMenuOpen(false);
    window.requestAnimationFrame(() => radioPickerButtonRef.current?.focus());
  }

  function handleRadioMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setRadioMenuOpen(false);
      radioPickerButtonRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-radio-station]"));
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -1 : 1;
    options[(currentIndex + direction + options.length) % options.length]?.focus();
  }

  async function toggleRadio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (radioPlaying) {
      audio.pause();
      setRadioPlaying(false);
      return;
    }
    try {
      await audio.play();
      setRadioPlaying(true);
    } catch {
      setError("Przeglądarka zablokowała autoodtwarzanie radia. Uruchom je ponownie przyciskiem Play.");
    }
  }

  if (activationRequired && !token) {
    return <DeviceActivation onActivated={load} />;
  }

  if (!payload || !activePages.length) {
    return (
      <main className="flex h-dvh w-dvw items-center justify-center bg-[#071522] p-10 text-center text-white">
        <div>
          <p className="text-2xl font-bold">IdeaSol Command Center</p>
          <p className="mt-3 text-lg text-slate-400">{error || "Ładowanie opublikowanego dashboardu…"}</p>
          {error && <button className="mt-6 rounded-xl bg-sky-500 px-5 py-3 font-bold" onClick={() => void load()}>Spróbuj ponownie</button>}
        </div>
      </main>
    );
  }

  const page = activePages[pageIndex % activePages.length];
  const theme = resolveTheme(payload, now);
  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
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
          dashboardName={payload.dashboard.name}
          metrics={payload.metrics}
          now={now}
          page={page}
          theme={theme}
          footer={
            <div className="flex w-full items-center justify-between gap-8 text-[17px]">
              <div className="flex items-center gap-4">
                {selectedRadioStation ? (
                  <>
                    <button type="button" onClick={() => void toggleRadio()} className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-xl text-white">
                      {radioPlaying ? "Ⅱ" : "▶"}
                    </button>
                    <div
                      className="cc-radio-picker"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setRadioMenuOpen(false);
                      }}
                    >
                      {radioMenuOpen && (
                        <div
                          aria-label="Wybierz stację radiową"
                          className="cc-radio-station-menu"
                          onKeyDown={handleRadioMenuKeyDown}
                          ref={radioMenuRef}
                          role="listbox"
                        >
                          <span className="cc-radio-station-menu-title">Wybierz radio</span>
                          {availableRadioStations.map((station) => (
                            <button
                              aria-selected={station.id === selectedRadioStation.id}
                              className="cc-radio-station-option"
                              data-radio-station
                              key={station.id}
                              onClick={() => selectRadioStation(station.id)}
                              role="option"
                              type="button"
                            >
                              <span>{station.name}</span>
                              {station.id === selectedRadioStation.id && <b aria-hidden="true">✓</b>}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        aria-expanded={radioMenuOpen}
                        aria-haspopup="listbox"
                        className="cc-radio-station-trigger"
                        onClick={() => setRadioMenuOpen((open) => !open)}
                        onKeyDown={(event) => {
                          if (!radioMenuOpen && (event.key === "ArrowUp" || event.key === "Enter")) {
                            event.preventDefault();
                            setRadioMenuOpen(true);
                          }
                        }}
                        ref={radioPickerButtonRef}
                        type="button"
                      >
                        <span><strong>{selectedRadioStation.name}</strong><small>Wybierz stację · {radioVolume}%</small></span>
                        <b aria-hidden="true">⌃</b>
                      </button>
                    </div>
                    <label className="flex items-center gap-3 text-sm text-slate-400"><span>Głośność</span><input aria-label="Głośność radia" className="w-32 accent-sky-500" type="range" min={0} max={100} value={radioVolume} onChange={(event) => setRadioVolumeOverride(Number(event.target.value))} /></label>
                    <audio ref={audioRef} src={selectedRadioStation.stream_url} preload="none" />
                  </>
                ) : <span className="text-slate-400">Radio wyłączone na tym urządzeniu</span>}
              </div>
              <div className="flex items-center gap-6 text-slate-400">
                <span>Ekran {pageIndex + 1}/{activePages.length}</span>
                <span>Wersja {payload.dashboard.versionNumber}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Urządzenie online" />
              </div>
            </div>
          }
        />
        {activeLiveEvent && <LiveEventAlert event={activeLiveEvent} exiting={liveEventExiting} key={activeLiveEvent.id} />}
      </div>
    </main>
  );
}
