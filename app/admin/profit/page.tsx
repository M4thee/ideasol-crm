import Link from "next/link";
import ProfitAdmin from "@/components/admin/ProfitAdmin";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { canAccessAdminPanel } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function ProfitAdminPage() {
  const profile = await getCurrentProfile();

  if (!canAccessAdminPanel(profile)) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900/50 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Brak dostępu</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">
            Panel IdeaSol Profit jest dostępny tylko dla administratora.
          </h1>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
          >
            Wróć do CRM
          </Link>
        </div>
      </main>
    );
  }

  return <ProfitAdmin />;
}
