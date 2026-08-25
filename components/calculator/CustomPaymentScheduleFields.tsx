import type { Dispatch, SetStateAction } from "react";

import {
  MAX_CUSTOM_PAYMENT_INSTALLMENTS,
  createDefaultCustomPaymentInstallments,
  formatCustomPaymentNumber,
  validateCustomPaymentSchedule,
  type CustomPaymentAmountType,
  type CustomPaymentInstallment,
  type CustomPaymentSchedule,
} from "@/lib/customPaymentSchedule";

type CustomPaymentScheduleFieldsProps = {
  value: CustomPaymentSchedule;
  onChange: Dispatch<SetStateAction<CustomPaymentSchedule>>;
  totalGross: number;
};

function createInstallment(index: number, amountType: CustomPaymentAmountType): CustomPaymentInstallment {
  return {
    id: `installment-${Date.now()}-${index}`,
    label: `transza ${index + 1}`,
    amount: 0,
    amountType,
    days: 0,
    timingRelation: "after",
    timingEvent: "contract_signing",
  };
}

export default function CustomPaymentScheduleFields({
  value,
  onChange,
  totalGross,
}: CustomPaymentScheduleFieldsProps) {
  const validationError = validateCustomPaymentSchedule(value, totalGross);
  const amountType = value.installments[0]?.amountType || "percent";
  const total = value.installments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);

  function updateInstallment(
    installmentId: string,
    changes: Partial<CustomPaymentInstallment>
  ) {
    onChange((current) => ({
      ...current,
      installments: current.installments.map((installment) =>
        installment.id === installmentId ? { ...installment, ...changes } : installment
      ),
    }));
  }

  function setInstallmentCount(rawCount: number) {
    const count = Math.max(1, Math.min(MAX_CUSTOM_PAYMENT_INSTALLMENTS, Math.floor(rawCount || 1)));
    onChange((current) => {
      const nextInstallments = current.installments.slice(0, count);
      while (nextInstallments.length < count) {
        nextInstallments.push(createInstallment(nextInstallments.length, amountType));
      }
      return { ...current, installments: nextInstallments };
    });
  }

  function setAmountType(nextAmountType: CustomPaymentAmountType) {
    onChange((current) => ({
      ...current,
      installments: current.installments.map((installment) => ({
        ...installment,
        amount: 0,
        amountType: nextAmountType,
      })),
    }));
  }

  return (
    <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/40 dark:bg-violet-950/20">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => {
            const enabled = event.target.checked;
            onChange((current) => ({
              enabled,
              installments:
                current.installments.length > 0
                  ? current.installments
                  : createDefaultCustomPaymentInstallments(),
            }));
          }}
          className="mt-1 h-5 w-5 accent-violet-600"
        />
        <div>
          <div className="font-black text-violet-950 dark:text-violet-100">
            Niestandardowa płatność
          </div>
          <p className="mt-1 text-xs leading-relaxed text-violet-700 dark:text-violet-300">
            Własny harmonogram zastąpi standardową zaliczkę i płatność końcową w umowie.
            Samo włączenie harmonogramu nie tworzy zadatku — jego skutki dotyczą wyłącznie
            transzy, w której etykiecie użyjesz słowa „zadatek”.
          </p>
        </div>
      </label>

      {value.enabled ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Liczba transz
              </span>
              <input
                type="number"
                min="1"
                max={MAX_CUSTOM_PAYMENT_INSTALLMENTS}
                step="1"
                value={value.installments.length || 1}
                onChange={(event) => setInstallmentCount(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-500/20"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Wartości transz
              </span>
              <select
                value={amountType}
                onChange={(event) => setAmountType(event.target.value as CustomPaymentAmountType)}
                className="mt-2 h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-500/20"
              >
                <option value="percent">Procent ceny brutto</option>
                <option value="gross_amount">Kwota w PLN brutto</option>
              </select>
            </label>
          </div>

          {value.installments.map((installment, index) => (
            <div
              key={installment.id}
              className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm dark:border-violet-500/30 dark:bg-slate-950"
            >
              <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                Transza {index + 1}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <label className="block xl:col-span-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Etykieta</span>
                  <input
                    value={installment.label}
                    onChange={(event) => updateInstallment(installment.id, { label: event.target.value })}
                    placeholder="np. zaliczka, zadatek, płatność końcowa"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-500/20"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {amountType === "percent" ? "Procent" : "Kwota brutto"}
                  </span>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={installment.amount || ""}
                      onChange={(event) =>
                        updateInstallment(installment.id, { amount: Number(event.target.value) })
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-12 text-sm text-slate-900 outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-500/20"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-500">
                      {amountType === "percent" ? "%" : "PLN"}
                    </span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Liczba dni</span>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    step="1"
                    disabled={installment.timingRelation === "on"}
                    value={installment.days}
                    onChange={(event) =>
                      updateInstallment(installment.id, {
                        days: Math.max(0, Math.min(365, Math.floor(Number(event.target.value) || 0))),
                      })
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:focus:ring-violet-500/20"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Przedrostek</span>
                  <select
                    value={installment.timingRelation}
                    onChange={(event) => {
                      const timingRelation = event.target.value as CustomPaymentInstallment["timingRelation"];
                      updateInstallment(installment.id, {
                        timingRelation,
                        days: timingRelation === "on" ? 0 : installment.days,
                      });
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-500/20"
                  >
                    <option value="before">przed</option>
                    <option value="after">po</option>
                    <option value="on">w dniu</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Moment</span>
                  <select
                    value={installment.timingEvent}
                    onChange={(event) =>
                      updateInstallment(installment.id, {
                        timingEvent: event.target.value as CustomPaymentInstallment["timingEvent"],
                      })
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-500/20"
                  >
                    <option value="contract_signing">podpisanie umowy</option>
                    <option value="installation_start">rozpoczęcie montażu</option>
                    <option value="installation_completion">zakończenie montażu</option>
                  </select>
                </label>
              </div>
            </div>
          ))}

          <div
            className={`rounded-xl px-4 py-3 text-sm font-bold ${
              validationError
                ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
                : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
            }`}
          >
            {validationError ||
              (amountType === "percent"
                ? `Suma transz: ${formatCustomPaymentNumber(total)}%`
                : `Suma transz odpowiada cenie brutto: ${formatCustomPaymentNumber(total)} PLN`)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
