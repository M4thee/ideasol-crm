"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CommandCenterDevicePayload } from "@/lib/command-center/types";
import CommandCenterCanvas from "./CommandCenterCanvas";

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

export default function CommandCenterTv({ token }: { token: string }) {
  const [payload, setPayload] = useState<CommandCenterDevicePayload | null>(null);
  const [error, setError] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(new Date());
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioVolumeOverride, setRadioVolumeOverride] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayAttemptedStationRef = useRef<string | null>(null);
  const activePages = useMemo(
    () => (payload?.snapshot.pages || []).filter((page) => page.enabled).sort((a, b) => a.order - b.order),
    [payload]
  );

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/command-center/device/${encodeURIComponent(token)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się pobrać dashboardu.");
      setPayload((current) => {
        if (current && current.dashboard.versionId !== result.dashboard.versionId) setPageIndex(0);
        return result as CommandCenterDevicePayload;
      });
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Brak połączenia z Command Center.");
    }
  }, [token]);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void load(), 0);
    const refreshId = window.setInterval(() => void load(), 15_000);
    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(refreshId);
    };
  }, [load]);

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

  const radioVolume = radioVolumeOverride ?? payload?.device.radio_volume ?? 0;

  useEffect(() => {
    if (!audioRef.current || !payload) return;
    audioRef.current.volume = radioVolume / 100;
  }, [payload, radioVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    const stationId = payload?.radioStation?.id || null;
    if (!audio || !payload?.device.radio_autoplay || !stationId || autoplayAttemptedStationRef.current === stationId) return;
    autoplayAttemptedStationRef.current = stationId;
    void audio.play().then(() => setRadioPlaying(true)).catch(() => undefined);
  }, [payload?.device.radio_autoplay, payload?.radioStation?.id]);

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
                {payload.radioStation ? (
                  <>
                    <button type="button" onClick={() => void toggleRadio()} className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-xl text-white">
                      {radioPlaying ? "Ⅱ" : "▶"}
                    </button>
                    <div><strong className="block">{payload.radioStation.name}</strong><span className="text-slate-400">Radio dla tego urządzenia · {radioVolume}%</span></div>
                    <label className="flex items-center gap-3 text-sm text-slate-400"><span>Głośność</span><input aria-label="Głośność radia" className="w-32 accent-sky-500" type="range" min={0} max={100} value={radioVolume} onChange={(event) => setRadioVolumeOverride(Number(event.target.value))} /></label>
                    <audio ref={audioRef} src={payload.radioStation.stream_url} preload="none" />
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
      </div>
    </main>
  );
}
