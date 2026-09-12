"use client";

import { useEffect, useState } from "react";

import type { CommandCenterMetrics } from "@/lib/command-center/types";
import { createDefaultCommandCenterSnapshot } from "@/lib/command-center/widget-registry";
import CommandCenterCanvas from "./CommandCenterCanvas";

const demoMetrics: CommandCenterMetrics = {
  generatedAt: new Date().toISOString(),
  leads: {
    today: 14,
    week: 63,
    month: 187,
    quarter: 514,
    contactedMonth: 142,
    contactRateMonth: 76,
    averageFirstActivityMinutes: 38,
    sources: [
      { label: "Formularz WWW", value: 71 },
      { label: "Polecenie", value: 44 },
      { label: "Kampania", value: 39 },
      { label: "Partner", value: 22 },
      { label: "Inne", value: 11 },
    ],
    statuses: [
      { label: "Nowy", value: 49 },
      { label: "W kontakcie", value: 46 },
      { label: "Spotkanie", value: 31 },
      { label: "Oferta", value: 27 },
      { label: "Sprzedaż", value: 21 },
    ],
  },
  sales: { today: 3, week: 12, month: 32, quarter: 91, valueToday: 48_000, valueWeek: 231_000, valueMonth: 684_000, valueQuarter: 1_934_000 },
  funnel: { leads: 187, contacted: 142, meetings: 79, offers: 48, sales: 32 },
  meetings: { today: 4, week: 21, month: 79, quarter: 204, scheduledToday: 9, upcomingToday: 5 },
  calls: { today: 47, week: 196, month: 731, quarter: 1_982 },
  leadMap: {
    validPostalCodes: 164,
    locatedLeads: 161,
    points: [
      { postalCode: "00-001", latitude: 52.2297, longitude: 21.0122, today: 3, week: 12, month: 31, quarter: 84 },
      { postalCode: "30-001", latitude: 50.0647, longitude: 19.945, today: 2, week: 8, month: 24, quarter: 61 },
      { postalCode: "80-001", latitude: 54.352, longitude: 18.6466, today: 1, week: 7, month: 19, quarter: 53 },
      { postalCode: "50-001", latitude: 51.1079, longitude: 17.0385, today: 2, week: 6, month: 17, quarter: 45 },
      { postalCode: "60-001", latitude: 52.4064, longitude: 16.9252, today: 1, week: 5, month: 14, quarter: 38 },
      { postalCode: "20-001", latitude: 51.2465, longitude: 22.5684, today: 0, week: 3, month: 9, quarter: 28 },
    ],
  },
  ranking: [
    { advisorId: "demo-a", advisorName: "Doradca A", leads: 38, contactedLeads: 31, contactRate: 82, sales: 9, salesValue: 194_000, conversion: 24 },
    { advisorId: "demo-b", advisorName: "Doradca B", leads: 41, contactedLeads: 33, contactRate: 80, sales: 8, salesValue: 171_000, conversion: 20 },
    { advisorId: "demo-c", advisorName: "Doradca C", leads: 35, contactedLeads: 25, contactRate: 71, sales: 6, salesValue: 139_000, conversion: 17 },
    { advisorId: "demo-d", advisorName: "Doradca D", leads: 32, contactedLeads: 24, contactRate: 75, sales: 5, salesValue: 102_000, conversion: 16 },
  ],
  reliability: ["Dane demonstracyjne — wyłącznie do testu układu"],
};

const demoPage = createDefaultCommandCenterSnapshot().pages[0];

export default function CommandCenterDemo() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function resize() {
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      <div style={{ height: 1080, left: "50%", position: "absolute", top: "50%", transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center", width: 1920 }}>
        <CommandCenterCanvas
          dashboardName="Podgląd deweloperski"
          footer={<div className="flex w-full items-center justify-between text-[17px]"><span className="text-slate-400">Anonimowe dane demonstracyjne · podgląd dostępny tylko lokalnie</span><span className="flex items-center gap-3 text-slate-400">Ekran 1/2 <i className="h-2 w-2 rounded-full bg-emerald-400" /></span></div>}
          metrics={demoMetrics}
          now={new Date("2026-09-10T10:30:00+02:00")}
          page={demoPage}
          theme="dark"
        />
      </div>
    </main>
  );
}
