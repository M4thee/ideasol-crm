import { Client } from "./types";
import ClientNotes from "./ClientNotes";
import ClientActivities from "./ClientActivities";

type ClientDetailsProps = {
  client: Client;
  currentUserId: string;
  onClose: () => void;
};

export default function ClientDetails({
  client,
  currentUserId,
  onClose,
}: ClientDetailsProps) {
  return (
    <section id="client-details" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 scroll-mt-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-2xl font-bold">
            {client.full_name || client.company_name || "Klient"}
          </h3>

          <p className="text-slate-500 mt-1">{client.client_type}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700"
        >
          Zamknij
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-8 text-sm">
        <div className="space-y-3">
          <div>
            <p className="text-slate-400">Telefon</p>
            <p className="font-medium">{client.phone || "—"}</p>
          </div>

          <div>
            <p className="text-slate-400">E-mail</p>
            <p className="font-medium">{client.email || "—"}</p>
          </div>

          <div>
            <p className="text-slate-400">NIP</p>
            <p className="font-medium">{client.nip || "—"}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-slate-400">Adres</p>

            <p className="font-medium">
              {[client.street, client.building_number]
                .filter(Boolean)
                .join(" ") || "—"}
            </p>
          </div>

          <div>
            <p className="text-slate-400">Kod pocztowy</p>
            <p className="font-medium">{client.postal_code || "—"}</p>
          </div>

          <div>
            <p className="text-slate-400">Miejscowość</p>
            <p className="font-medium">{client.city || "—"}</p>
          </div>
        </div>
      </div>

      <ClientNotes clientId={client.id} currentUserId={currentUserId} />

      <ClientActivities clientId={client.id} currentUserId={currentUserId} />
    </section>
  );
}