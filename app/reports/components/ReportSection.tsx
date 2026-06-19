import type { ReactNode } from "react";

type ReportSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ReportSection({ title, description, children }: ReportSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>

      {children}
    </section>
  );
}