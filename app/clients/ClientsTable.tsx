import { Fragment } from "react";
import { Client } from "./types";

type ClientsTableProps = {
  clients: Client[];
  loadingClients: boolean;
  selectedClient: Client | null;
  onSelectClient: (client: Client) => void;
  onCloseClient: () => void;
};

export default function ClientsTable({
  clients,
  loadingClients,
  selectedClient,
  onSelectClient,
  onCloseClient,
}: ClientsTableProps) {
  function getClientDisplayName(client: Client) {
    return client.full_name || client.company_name || "Brak nazwy klienta";
  }

  function getClientDisplayAddress(client: Client) {
    const streetAddress = [client.street, client.building_number]
      .filter(Boolean)
      .join(" ");

    const cityAddress = [client.postal_code, client.city]
      .filter(Boolean)
      .join(" ");

    return [streetAddress, cityAddress].filter(Boolean).join(", ") || "Brak adresu";
  }

  function openClientCard(clientId: string) {
    window.location.href = `/clients/${clientId}`;
  }
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-500">
          <tr>
            <th className="text-left px-4 py-3">Klient</th>
            <th className="text-left px-4 py-3">Typ</th>
            <th className="text-left px-4 py-3">Telefon</th>
            <th className="text-left px-4 py-3">Miasto</th>
          </tr>
        </thead>

        <tbody>
          {loadingClients ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-6 text-center text-slate-400"
              >
                Ładowanie klientów...
              </td>
            </tr>
          ) : clients.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-6 text-center text-slate-400"
              >
                Brak klientów.
              </td>
            </tr>
          ) : (
            clients.map((client) => (
              <Fragment key={client.id}>
                <tr
                  onClick={() => onSelectClient(client)}
                  className="border-t border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium">
                    {client.full_name || client.company_name || "—"}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {client.client_type || "—"}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {client.phone || "—"}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {client.city || "—"}
                  </td>
                </tr>

                {selectedClient?.id === client.id && (
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={4} className="p-6">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-sm text-slate-500 mb-1">
                              Szybki podgląd kontaktu
                            </p>

                            <h2 className="text-2xl font-bold text-slate-900">
                              {getClientDisplayName(client)}
                            </h2>

                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
                                {client.client_type || "Brak typu"}
                              </span>

                              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-sm font-semibold">
                                {client.status || "Brak statusu"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openClientCard(client.id);
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm"
                            >
                              Otwórz kartę kontaktu
                            </button>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onCloseClient();
                              }}
                              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                            >
                              Zamknij
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm">
                          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                              Telefon
                            </p>
                            <p className="font-semibold text-slate-900">
                              {client.phone || "Brak"}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                              Email
                            </p>
                            <p className="font-semibold text-slate-900 break-all">
                              {client.email || "Brak"}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 lg:col-span-2">
                            <p className="text-xs uppercase font-semibold text-slate-400 mb-1">
                              Adres
                            </p>
                            <p className="font-semibold text-slate-900">
                              {getClientDisplayAddress(client)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}