type AddClientModalProps = {
  open: boolean;
  clientType: string;
  setClientType: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
  companyName: string;
  setCompanyName: (value: string) => void;
  contactPerson: string;
  setContactPerson: (value: string) => void;
  nip: string;
  setNip: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  clientEmail: string;
  setClientEmail: (value: string) => void;
  street: string;
  setStreet: (value: string) => void;
  buildingNumber: string;
  setBuildingNumber: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  postalCode: string;
  setPostalCode: (value: string) => void;
  savingClient: boolean;
  clientError: string;
  createClient: () => void;
  onClose: () => void;
};

export default function AddClientModal({
  open,
  clientType,
  setClientType,
  fullName,
  setFullName,
  companyName,
  setCompanyName,
  contactPerson,
  setContactPerson,
  nip,
  setNip,
  phone,
  setPhone,
  clientEmail,
  setClientEmail,
  street,
  setStreet,
  buildingNumber,
  setBuildingNumber,
  city,
  setCity,
  postalCode,
  setPostalCode,
  savingClient,
  clientError,
  createClient,
  onClose,
}: AddClientModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Nowy klient</h2>

            <p className="text-slate-500 text-sm mt-1">
              Dodaj nowego klienta do CRM.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex gap-3">
            <button
              type="button"
              onClick={() => setClientType("B2C")}
              className={`px-4 py-2 rounded-xl border ${
                clientType === "B2C"
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              B2C
            </button>

            <button
              type="button"
              onClick={() => setClientType("B2B")}
              className={`px-4 py-2 rounded-xl border ${
                clientType === "B2B"
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              B2B
            </button>
          </div>

          {clientType === "B2C" ? (
            <input
              type="text"
              placeholder="Imię i nazwisko"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="md:col-span-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
            />
          ) : (
            <>
              <input
                type="text"
                placeholder="Nazwa firmy"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Osoba kontaktowa"
                value={contactPerson}
                onChange={(event) => setContactPerson(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
              />

              <input
                type="text"
                placeholder="NIP"
                value={nip}
                onChange={(event) => setNip(event.target.value)}
                className="md:col-span-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
            </>
          )}

          <input
            type="text"
            placeholder="Telefon"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
          />

          <input
            type="email"
            placeholder="E-mail"
            value={clientEmail}
            onChange={(event) => setClientEmail(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
          />

          <div className="md:col-span-2 mt-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">
              Adres <span className="text-slate-400 font-normal">opcjonalnie</span>
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Ulica"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Nr domu / lokalu"
                value={buildingNumber}
                onChange={(event) => setBuildingNumber(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Miejscowość"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Kod pocztowy"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
              />
            </div>
          </div>
        </div>

        {clientError && (
          <p className="text-red-500 text-sm mt-4">{clientError}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
          >
            Anuluj
          </button>

          <button
            type="button"
            onClick={createClient}
            disabled={savingClient}
            className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold disabled:opacity-50"
          >
            {savingClient ? "Zapisywanie..." : "Dodaj klienta"}
          </button>
        </div>
      </div>
    </div>
  );
}