"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const ROLES = ["owner", "admin", "manager", "seller", "cc"] as const;

type Role = (typeof ROLES)[number];

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: Role;
  manager_id: string | null;
  is_active?: boolean;
hidden_from_assignment?: boolean | null;
};

export default function AdminUsersPage() {

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [editedProfiles, setEditedProfiles] = useState<
    Record<string, Partial<Profile>>
  >({});

  const [creatingUser, setCreatingUser] = useState(false);

  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);

  const [resetPasswordValue, setResetPasswordValue] = useState("");

  const [resetPasswordConfirmValue, setResetPasswordConfirmValue] =
    useState("");

  const [resettingPassword, setResettingPassword] = useState(false);

  const [newUser, setNewUser] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "seller" as Role,
    manager_id: "",
  });

  useEffect(() => {
    loadProfiles();
    loadCurrentUserRole();
  }, []);

  async function loadCurrentUserRole() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUserRole(null);
        setAuthLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setCurrentUserRole(profile?.role || null);
    } catch (error) {
      console.error("Błąd pobierania roli", error);
      setCurrentUserRole(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadProfiles() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, email, role, manager_id, hidden_from_assignment")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "Błąd pobierania profiles",
        JSON.stringify(error, null, 2)
      );
      setLoading(false);
      return;
    }

    setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }

  async function updateProfile(
    userId: string,
    values: Partial<Profile>
  ) {
    setSavingUserId(userId);

    const payload: Partial<Profile> = {
      ...values,
    };

    console.log("UPDATE USER ID", userId);
    console.log("UPDATE PROFILE PAYLOAD", payload);

    const response = await fetch("/api/admin/users/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_user_role: "admin",
        user_id: userId,
        values: payload,
      }),
    });
    
    const result = await response.json();

    console.log("UPDATE API RESULT", result);

    if (!response.ok) {
      console.error(
        "Błąd aktualizacji użytkownika",
        JSON.stringify(result, null, 2)
      );

      alert(result.error || "Nie udało się zapisać zmian.");
      setSavingUserId(null);
      return;
    }

    await loadProfiles();

    setSavingUserId(null);
  }

  function updateEditedProfile(
    userId: string,
    values: Partial<Profile>
  ) {
    setEditedProfiles((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...values,
      },
    }));
  }

  async function saveProfileChanges(profile: Profile) {
    const changes = editedProfiles[profile.id];

    if (!changes || Object.keys(changes).length === 0) {
      alert("Brak zmian do zapisania.");
      return;
    }

    const changeLines: string[] = [];

    if (
      Object.prototype.hasOwnProperty.call(changes, "display_name") &&
      changes.display_name !== profile.display_name
    ) {
      changeLines.push(
        `Nazwa: ${profile.display_name || "Brak"} → ${changes.display_name || "Brak"}`
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(changes, "email") &&
      changes.email !== profile.email
    ) {
      changeLines.push(
        `Email: ${profile.email || "Brak"} → ${changes.email || "Brak"}`
      );
    }

    if (changes.role && changes.role !== profile.role) {
      changeLines.push(
        `Rola: ${profile.role} → ${changes.role}`
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(changes, "manager_id") &&
      changes.manager_id !== profile.manager_id
    ) {
      const previousManager =
        managers.find((m) => m.id === profile.manager_id)?.display_name ||
        "Brak managera";

      const nextManager =
        managers.find((m) => m.id === changes.manager_id)?.display_name ||
        "Brak managera";

      changeLines.push(
        `Manager: ${previousManager} → ${nextManager}`
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(
        changes,
        "hidden_from_assignment"
      ) &&
      changes.hidden_from_assignment !==
        profile.hidden_from_assignment
    ) {
      changeLines.push(
        `Widoczność w przypisaniach: ${
          profile.hidden_from_assignment
            ? "Ukryty"
            : "Widoczny"
        } → ${
          changes.hidden_from_assignment
            ? "Ukryty"
            : "Widoczny"
        }`
      );
    }
    const confirmed = window.confirm(
      `Czy na pewno chcesz zapisać zmiany?\n\n${changeLines.join("\n")}`
    );

    if (!confirmed) {
      return;
    }

    console.log("SAVE CHANGES", changes);
    await updateProfile(profile.id, changes);

    setEditedProfiles((current) => {
      const copy = { ...current };
      delete copy[profile.id];
      return copy;
    });
  }

  async function createUser() {
    try {
      setCreatingUser(true);

      const response = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_user_role: "admin",
          display_name: newUser.display_name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          manager_id:
            newUser.role === "seller"
              ? newUser.manager_id || null
              : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Nie udało się utworzyć użytkownika");
        setCreatingUser(false);
        return;
      }

      setNewUser({
        display_name: "",
        email: "",
        password: "",
        role: "seller",
        manager_id: "",
      });

      await loadProfiles();

      alert("Użytkownik został utworzony.");
    } catch (error) {
      console.error("Błąd create user", error);
      alert("Błąd tworzenia użytkownika.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function resetUserPassword(profile: Profile) {
    if (!resetPasswordUserId) {
      return;
    }

    if (resetPasswordValue.length < 8) {
      alert("Hasło musi mieć minimum 8 znaków.");
      return;
    }

    if (!/[A-Z]/.test(resetPasswordValue)) {
      alert("Hasło musi zawierać minimum 1 dużą literę.");
      return;
    }

    if (!/[0-9]/.test(resetPasswordValue)) {
      alert("Hasło musi zawierać minimum 1 cyfrę.");
      return;
    }

    if (resetPasswordValue !== resetPasswordConfirmValue) {
      alert("Hasła nie są identyczne.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz zmienić hasło użytkownika:\n\n${profile.display_name || profile.email}`
    );

    if (!confirmed) {
      return;
    }

    try {
      setResettingPassword(true);

      const response = await fetch(
        "/api/admin/users/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_user_role: "admin",
            user_id: profile.id,
            password: resetPasswordValue,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Nie udało się zresetować hasła");
        return;
      }

      alert("Hasło zostało zmienione.");

      setResetPasswordUserId(null);
      setResetPasswordValue("");
      setResetPasswordConfirmValue("");
    } catch (error) {
      console.error("Błąd reset password", error);
      alert("Błąd resetu hasła.");
    } finally {
      setResettingPassword(false);
    }
  }

  async function deleteUser(profile: Profile) {
    const confirmed = window.confirm(
      `Czy na pewno chcesz dezaktywować użytkownika:\n\n${profile.display_name || profile.email}`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingUserId(profile.id);

      const response = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_user_role: "admin",
          user_id: profile.id,
          values: {
            is_active: false,
            hidden_from_assignment: true,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(
          typeof data.error === "object"
            ? JSON.stringify(data.error, null, 2)
            : data.error || "Nie udało się dezaktywować użytkownika"
        );

        console.error("DEACTIVATE USER RESPONSE", data);

        setSavingUserId(null);
        return;
      }

      await loadProfiles();

      alert("Użytkownik został dezaktywowany.");
    } catch (error) {
      console.error("Błąd dezaktywacji użytkownika", error);
      alert("Błąd dezaktywacji użytkownika.");
    } finally {
      setSavingUserId(null);
    }
  }

  const managers = profiles.filter(
    (profile) => profile.role === "manager"
  );

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500 text-lg">
          Sprawdzanie uprawnień...
        </div>
      </main>
    );
  }

  if (currentUserRole !== "admin") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="rounded-3xl border border-red-200 bg-white px-8 py-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-red-600">
            Brak dostępu
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Tylko administrator może korzystać z tego panelu.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Użytkownicy CRM
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Zarządzanie rolami i przypisaniem sellerów do managerów.
              </p>
            </div>

            <button
              onClick={createUser}
              disabled={creatingUser}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingUser ? "Tworzenie..." : "Dodaj użytkownika"}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Nowy użytkownik
            </h2>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Imię i nazwisko"
                value={newUser.display_name}
                onChange={(e) =>
                  setNewUser((current) => ({
                    ...current,
                    display_name: e.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              />

              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser((current) => ({
                    ...current,
                    email: e.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              />

              <input
                type="text"
                placeholder="Hasło"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser((current) => ({
                    ...current,
                    password: e.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              />

              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((current) => ({
                    ...current,
                    role: e.target.value as Role,
                    manager_id:
                      e.target.value === "seller"
                        ? current.manager_id
                        : "",
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              {newUser.role === "seller" ? (
                <select
                  value={newUser.manager_id}
                  onChange={(e) =>
                    setNewUser((current) => ({
                      ...current,
                      manager_id: e.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
                >
                  <option value="">Brak managera</option>

                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.display_name || manager.email}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-400">
                  Manager nie dotyczy
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500">
              Ładowanie użytkowników...
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-sm font-semibold text-slate-600">
                    <th className="px-4 py-3">Użytkownik</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Hasło</th>
                    <th className="px-4 py-3">Rola</th>
                    <th className="px-4 py-3">Manager</th>
                    <th className="px-4 py-3">
  Widoczny w przypisaniach
</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Akcje</th>
                    <th className="px-4 py-3">Zapis</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {profiles.map((profile) => {
                    const isSeller = profile.role === "seller";
                    const editedProfile = editedProfiles[profile.id] || {};

                    return (
                      <tr key={profile.id}>
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            value={editedProfile.display_name ?? profile.display_name ?? ""}
                            onChange={(e) => {
                              updateEditedProfile(profile.id, {
                                display_name: e.target.value,
                              });
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <input
                            type="email"
                            value={editedProfile.email ?? profile.email ?? ""}
                            onChange={(e) => {
                              updateEditedProfile(profile.id, {
                                email: e.target.value,
                              });
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setResetPasswordUserId(profile.id);
                              setResetPasswordValue("");
                              setResetPasswordConfirmValue("");
                            }}
                            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                          >
                            Reset hasła
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <select
                            value={editedProfile.role ?? profile.role}
                            onChange={(e) => {
                              const nextRole = e.target.value as Role;

                              updateEditedProfile(profile.id, {
                                role: nextRole,
                                manager_id:
                                  nextRole === "seller"
                                    ? profile.manager_id
                                    : null,
                              });
                            }}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-4">
                          {isSeller ? (
                            <select
                              value={editedProfile.manager_id ?? profile.manager_id ?? ""}
                              onChange={(e) => {
                                const managerId = e.target.value || null;

                                updateEditedProfile(profile.id, {
                                  manager_id: managerId,
                                });
                              }}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                            >
                              <option value="">Brak managera</option>

                              {managers.map((manager) => (
                                <option key={manager.id} value={manager.id}>
                                  {manager.display_name || manager.email}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Nie dotyczy
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
  <label className="flex items-center gap-3 text-sm text-slate-700">
    <input
      type="checkbox"
      checked={
        editedProfile.hidden_from_assignment !== undefined
          ? !editedProfile.hidden_from_assignment
          : !(profile.hidden_from_assignment ?? false)
      }
      onChange={(e) => {
        updateEditedProfile(profile.id, {
          hidden_from_assignment: Boolean(!e.target.checked),
        });
      }}
      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
    />

    <span>
      {editedProfile.hidden_from_assignment !== undefined
        ? !editedProfile.hidden_from_assignment
          ? "Widoczny"
          : "Ukryty"
        : !(profile.hidden_from_assignment ?? false)
          ? "Widoczny"
          : "Ukryty"}
    </span>
  </label>
</td>       
                        <td className="px-4 py-4 text-sm">
                          {savingUserId === profile.id ? (
                            <span className="text-amber-600">
                              Zapisywanie...
                            </span>
                          ) : (
                            <span
                              className={
                                editedProfiles[profile.id]
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }
                            >
                              {editedProfiles[profile.id]
                                ? "Niezapisane zmiany"
                                : "Gotowe"}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => deleteUser(profile)}
                            disabled={savingUserId === profile.id}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            Dezaktywuj
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => saveProfileChanges(profile)}
                            disabled={
                              savingUserId === profile.id ||
                              !editedProfiles[profile.id]
                            }
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Zapisz zmiany
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {resetPasswordUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">
              Reset hasła
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Wprowadź nowe hasło użytkownika.
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="password"
                placeholder="Nowe hasło"
                value={resetPasswordValue}
                onChange={(e) =>
                  setResetPasswordValue(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              />

              <input
                type="password"
                placeholder="Powtórz hasło"
                value={resetPasswordConfirmValue}
                onChange={(e) =>
                  setResetPasswordConfirmValue(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              />

              <div className="rounded-2xl bg-slate-100 p-4 text-xs text-slate-500">
                Hasło musi zawierać minimum:
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>8 znaków</li>
                  <li>1 dużą literę</li>
                  <li>1 cyfrę</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setResetPasswordUserId(null);
                  setResetPasswordValue("");
                  setResetPasswordConfirmValue("");
                }}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                disabled={resettingPassword}
                onClick={() => {
                  const profile = profiles.find(
                    (p) => p.id === resetPasswordUserId
                  );

                  if (!profile) {
                    return;
                  }

                  resetUserPassword(profile);
                }}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {resettingPassword
                  ? "Zmiana hasła..."
                  : "Zmień hasło"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}