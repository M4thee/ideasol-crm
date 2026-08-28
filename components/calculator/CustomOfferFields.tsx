import {
  createCustomOfferItem,
  getCustomOfferItemQuantity,
  getCustomOfferNetTotal,
  type CustomOfferItem,
} from "@/lib/calculator/customOffer";

type CustomOfferFieldsProps = {
  items: CustomOfferItem[];
  onChange: (items: CustomOfferItem[]) => void;
  onInvalidate: () => void;
};

const inputClass =
  "mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-violet-100/40 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-violet-500/40 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:focus:border-violet-400 dark:focus:ring-violet-500/20";

export default function CustomOfferFields({
  items,
  onChange,
  onInvalidate,
}: CustomOfferFieldsProps) {
  function updateItem(itemId: string, changes: Partial<CustomOfferItem>) {
    onChange(
      items.map((item) => (item.id === itemId ? { ...item, ...changes } : item))
    );
    onInvalidate();
  }

  function removeItem(itemId: string) {
    const remainingItems = items.filter((item) => item.id !== itemId);
    onChange(remainingItems.length > 0 ? remainingItems : [createCustomOfferItem()]);
    onInvalidate();
  }

  function addItem() {
    onChange([...items, createCustomOfferItem()]);
    onInvalidate();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/60 p-4 dark:border-violet-500/50 dark:bg-violet-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="font-black text-violet-800 dark:text-violet-200">
              Pozycje oferty niestandardowej
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-violet-700/80 dark:text-violet-300/80">
              Wpisz dowolny towar lub usługę. Pusta ilość oznacza 1 sztukę.
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="shrink-0 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-600"
          >
            + Dodaj pozycję
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-500/30 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                  Pozycja {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  aria-label={`Usuń pozycję ${index + 1}`}
                >
                  Usuń
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px_200px]">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Nazwa produktu lub usługi
                  </span>
                  <input
                    className={inputClass}
                    type="text"
                    placeholder="np. Klimatyzator z montażem"
                    value={item.name}
                    onChange={(event) => updateItem(item.id, { name: event.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Ilość (opcjonalnie)
                  </span>
                  <input
                    className={inputClass}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="1"
                    value={item.quantity ?? ""}
                    onChange={(event) =>
                      updateItem(item.id, {
                        quantity: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Cena netto / szt.
                  </span>
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-12`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={item.unitNet || ""}
                      onChange={(event) =>
                        updateItem(item.id, { unitNet: Number(event.target.value) })
                      }
                    />
                    <span className="pointer-events-none absolute bottom-3 right-4 text-sm font-semibold text-slate-400">
                      zł
                    </span>
                  </div>
                </label>
              </div>

              {item.name.trim() && item.unitNet > 0 ? (
                <p className="mt-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Wartość netto: {(
                    item.unitNet * getCustomOfferItemQuantity(item)
                  ).toLocaleString("pl-PL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} zł
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Razem netto
        </span>
        <strong className="text-lg text-slate-950 dark:text-white">
          {getCustomOfferNetTotal(items).toLocaleString("pl-PL", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} zł
        </strong>
      </div>
    </div>
  );
}
