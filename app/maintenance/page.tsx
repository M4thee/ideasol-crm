export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <section className="max-w-xl text-center">
        <div className="mb-6 text-5xl">🛠️</div>

        <h1 className="text-3xl font-bold mb-4">
          Trwają prace konserwacyjne systemu CRM
        </h1>

        <p className="text-slate-300 text-lg">
          Planowany czas zakończenia:
        </p>

        <p className="mt-2 text-2xl font-bold text-emerald-400">
          29.05.2026, godz. 06:00
        </p>

        <p className="mt-8 text-sm text-slate-500">
          IdeaSol CRM
        </p>
      </section>
    </main>
  );
}