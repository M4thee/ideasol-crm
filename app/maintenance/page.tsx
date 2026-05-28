import Image from "next/image";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-[#f3f7fb] px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col items-center px-8 py-14 text-center sm:px-14 sm:py-20">
            <div className="mb-8 flex items-center justify-center rounded-3xl bg-slate-50 px-8 py-6 shadow-inner">
              <Image
                src="/logo.png"
                alt="IdeaSol"
                width={150}
                height={90}
                priority
                className="h-auto w-[150px]"
              />
            </div>

            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              Prace konserwacyjne
            </div>

            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Trwają prace konserwacyjne systemu CRM.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Trwają zaplanowane prace konserwacyjne oraz aktualizacja systemu CRM.
            </p>

            <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 px-8 py-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                Planowany czas zakończenia
              </p>
              <p className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
                29.05.2026, godz. 06:00
              </p>
            </div>

            <p className="mt-10 text-base font-semibold text-slate-500">
              Wasz jednoosobowy dział IT.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}