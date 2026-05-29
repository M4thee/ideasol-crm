"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminPanel from "@/components/calculator/AdminPanel";

const ROLES = ["owner", "admin", "manager", "seller", "cc"] as const;

type Role = (typeof ROLES)[number];

type Profile = {
  id: string;
  user_number: number;
  display_name: string | null;
  email: string | null;
  role: Role;
  manager_id: string | null;
  is_active?: boolean;
  hidden_from_assignment?: boolean | null;
};

type ClientTag = {
  id: string;
  name: string;
  color: string | null;
  is_system: boolean | null;
  is_active: boolean | null;
  created_at?: string | null;
};

const DEFAULT_PRICING_OVERRIDES = {
  installation: {
    pvPerKwNet: 500,
  },
  placeholders: {
    protections: 1500,
    wiring: 800,
    transport: 500,
    documentation: 700,
    ems: 1200,
  },
  margins: {
    marketing: 500,
    ownersCount: 3,
    pvSmallPerKw: 250,
    pvSmallFixed: 500,
    pvLargePerKw: 150,
    pvLargeFixed: 700,
    storagePerOwner: 500,
    managerFeeNet: 500,
  },
  operator: {
    percent: 15,
  },
};

export default function AdminUsersPage() {

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clientTags, setClientTags] = useState<ClientTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagTableMissing, setTagTableMissing] = useState(false);
  const [newTag, setNewTag] = useState({
    name: "",
    color: "slate",
    is_system: false,
  });

  const [activeSection, setActiveSection] = useState<"users" | "tags" | "pricing">("users");
  const [adminStatus, setAdminStatus] = useState("");
  const [pricingOverrides, setPricingOverrides] = useState(DEFAULT_PRICING_OVERRIDES);

  const [searchTerm, setSearchTerm] = useState("");

  const [sortConfig, setSortConfig] = useState<{
    key: "user_number" | "display_name" | "role";
    direction: "asc" | "desc";
  }>({
    key: "user_number",
    direction: "asc",
  });

  const [editedProfiles, setEditedProfiles] = useState<
    Record<string, Partial<Profile>>
  >({});
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [deactivationModalOpen, setDeactivationModalOpen] = useState(false);
  const [deactivationTargetIds, setDeactivationTargetIds] = useState<string[]>([]);
  const [reassignClientsToUserId, setReassignClientsToUserId] = useState("unassigned");
  const [reassignUserSearch, setReassignUserSearch] = useState("");
  const [processingDeactivation, setProcessingDeactivation] = useState(false);

  // --- Restore conflict UI state ---
  const [restoreConflictModalOpen, setRestoreConflictModalOpen] = useState(false);
  const [restoreConflictProfile, setRestoreConflictProfile] = useState<Profile | null>(null);
  const [restoreConflictLogId, setRestoreConflictLogId] = useState<string | null>(null);
  const [restoreClientChoices, setRestoreClientChoices] = useState<
    Array<{
      id: string;
      full_name: string | null;
      assigned_user_id: string | null;
      previous_assigned_to: string | null;
      previous_assigned_user_id: string | null;
      restore: boolean;
    }>
  >([]);
  const [processingRestoreSelection, setProcessingRestoreSelection] = useState(false);

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
    loadClientTags();
    loadPricingSettings();
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

  async function loadPricingSettings() {
    const { data, error } = await supabase
      .from("pricing_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn("Nie udało się załadować ustawień kalkulatora w panelu admina", error);
      return;
    }

    if (!data) {
      return;
    }

    setPricingOverrides((current) => ({
      ...current,
      installation: {
        ...current.installation,
        pvPerKwNet: Number(data.installation_pv_per_kw ?? current.installation.pvPerKwNet),
      },
      placeholders: {
        ...current.placeholders,
        protections: Number(data.protections_cost ?? current.placeholders.protections),
        wiring: Number(data.wiring_cost ?? current.placeholders.wiring),
        transport: Number(data.transport_cost ?? current.placeholders.transport),
        documentation: Number(data.documentation_cost ?? current.placeholders.documentation),
        ems: Number(data.ems_cost ?? current.placeholders.ems),
      },
      margins: {
        ...current.margins,
        marketing: Number(data.marketing_cost ?? current.margins.marketing),
        ownersCount: Number(data.owners_count ?? current.margins.ownersCount),
        pvSmallPerKw: Number(data.pv_small_per_kw ?? current.margins.pvSmallPerKw),
        pvSmallFixed: Number(data.pv_small_fixed ?? current.margins.pvSmallFixed),
        pvLargePerKw: Number(data.pv_large_per_kw ?? current.margins.pvLargePerKw),
        pvLargeFixed: Number(data.pv_large_fixed ?? current.margins.pvLargeFixed),
        storagePerOwner: Number(data.storage_per_owner ?? current.margins.storagePerOwner),
        managerFeeNet: Number(data.manager_fee_percent ?? current.margins.managerFeeNet),
      },
      operator: {
        ...current.operator,
        percent: Number(data.warranty_percent ?? current.operator.percent),
      },
    }));
  }

  function updatePricingValue(path: string[], value: string) {
    const numberValue = Number(value.replace(",", "."));
    const safeValue = Number.isFinite(numberValue) ? numberValue : 0;

    setPricingOverrides((current) => {
      const next = structuredClone(current);
      let target: any = next;

      for (let index = 0; index < path.length - 1; index++) {
        target = target[path[index]];
      }

      target[path[path.length - 1]] = safeValue;

      return next;
    });

    setAdminStatus("Masz niezapisane zmiany w ustawieniach kalkulatora");
  }

  async function savePricingSettings() {
    setAdminStatus("Zapisywanie ustawień kalkulatora...");

    const pricing = pricingOverrides;

    const { error } = await supabase
      .from("pricing_settings")
      .update({
        installation_pv_per_kw: pricing.installation.pvPerKwNet,
        protections_cost: pricing.placeholders.protections,
        wiring_cost: pricing.placeholders.wiring,
        transport_cost: pricing.placeholders.transport,
        documentation_cost: pricing.placeholders.documentation,
        ems_cost: pricing.placeholders.ems,
        marketing_cost: pricing.margins.marketing,
        owners_count: pricing.margins.ownersCount,
        pv_small_per_kw: pricing.margins.pvSmallPerKw,
        pv_small_fixed: pricing.margins.pvSmallFixed,
        pv_large_per_kw: pricing.margins.pvLargePerKw,
        pv_large_fixed: pricing.margins.pvLargeFixed,
        storage_per_owner: pricing.margins.storagePerOwner,
        manager_fee_percent: pricing.margins.managerFeeNet,
        warranty_percent: pricing.operator.percent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      console.error("Błąd zapisu ustawień kalkulatora z panelu admina", error);
      setAdminStatus("Błąd zapisu ustawień kalkulatora");
      return;
    }

    setAdminStatus("Zapisano ustawienia kalkulatora");
  }

  function resetPricingOverrides() {
    setPricingOverrides(DEFAULT_PRICING_OVERRIDES);
    setAdminStatus("Przywrócono wartości domyślne — kliknij Zapisz ustawienia, żeby utrwalić je w bazie");
  }

  // --- Client Tags Admin Section ---
  async function loadClientTags() {
    setLoadingTags(true);
    setTagTableMissing(false);

    const { data, error } = await supabase
      .from("client_tags")
      .select("id, name, color, is_system, is_active, created_at")
      .order("name", { ascending: true });
 
    if (error) {
      console.error("Błąd pobierania tagów klientów", error);

      if (error.code === "PGRST205" || error.message?.includes("client_tags")) {
        setTagTableMissing(true);
      }

      setClientTags([]);
      setLoadingTags(false);
      return;
    }

    setClientTags((data ?? []) as ClientTag[]);
    setLoadingTags(false);
  }

  async function createClientTag() {
    const tagName = newTag.name.trim();

    if (!tagName) {
      alert("Podaj nazwę tagu.");
      return;
    }

    try {
      setCreatingTag(true);

      const { error } = await supabase.from("client_tags").insert({
        name: tagName,
        color: newTag.color,
        is_system: newTag.is_system,
        is_active: true,
      });

      if (error) {
        console.error("Błąd tworzenia tagu", error);
        alert("Nie udało się utworzyć tagu. Sprawdź, czy tabela client_tags istnieje w Supabase.");
        return;
      }

      setNewTag({
        name: "",
        color: "slate",
        is_system: false,
      });

      await loadClientTags();
    } finally {
      setCreatingTag(false);
    }
  }

  async function toggleClientTagActive(tag: ClientTag) {
    const nextValue = !(tag.is_active ?? true);

    const { error } = await supabase
      .from("client_tags")
      .update({ is_active: nextValue })
      .eq("id", tag.id);

    if (error) {
      console.error("Błąd zmiany statusu tagu", error);
      alert("Nie udało się zmienić statusu tagu.");
      return;
    }

    await loadClientTags();
  }

  async function deleteClientTag(tag: ClientTag) {
    if (tag.is_system) {
      alert("Tag systemowy można wyłączyć, ale nie można go usunąć.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć tag:\n\n${tag.name}?\n\nTag zostanie usunięty również z kart klientów.`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("client_tags")
      .delete()
      .eq("id", tag.id);

    if (error) {
      console.error("Błąd usuwania tagu", error);
      alert("Nie udało się usunąć tagu.");
      return;
    }

    await loadClientTags();
  }

  async function loadProfiles() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_number, display_name, email, role, manager_id, hidden_from_assignment, is_active")
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

    setSelectedProfileIds((current) =>
      current.includes(userId) ? current : [...current, userId]
    );
  }

  function toggleSelectedProfile(userId: string) {
    setSelectedProfileIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  }

  function toggleAllVisibleProfiles() {
    const visibleIds = filteredProfiles.map((profile) => profile.id);

    if (visibleIds.length === 0) {
      return;
    }

    const allVisibleSelected = visibleIds.every((id) =>
      selectedProfileIds.includes(id)
    );

    setSelectedProfileIds(allVisibleSelected ? [] : visibleIds);
  }

  async function saveSelectedProfileChanges() {
    const profilesToSave = profiles.filter(
      (profile) =>
        selectedProfileIds.includes(profile.id) && editedProfiles[profile.id]
    );

    if (profilesToSave.length === 0) {
      alert("Brak zaznaczonych użytkowników ze zmianami do zapisania.");
      return;
    }

    const confirmed = window.confirm(
      `Czy zapisać zmiany dla zaznaczonych użytkowników?\n\nLiczba użytkowników: ${profilesToSave.length}`
    );

    if (!confirmed) {
      return;
    }

    for (const profile of profilesToSave) {
      await updateProfile(profile.id, editedProfiles[profile.id]);
    }

    setEditedProfiles((current) => {
      const copy = { ...current };

      profilesToSave.forEach((profile) => {
        delete copy[profile.id];
      });

      return copy;
    });
  }

  function deactivateSelectedProfiles() {
    const profilesToDeactivate = profiles.filter((profile) =>
      selectedProfileIds.includes(profile.id)
    );

    if (profilesToDeactivate.length === 0) {
      alert("Zaznacz użytkowników do dezaktywacji.");
      return;
    }

    setDeactivationTargetIds(profilesToDeactivate.map((profile) => profile.id));
    setReassignClientsToUserId("unassigned");
    setReassignUserSearch("");
    setDeactivationModalOpen(true);
  }

  async function confirmDeactivateUsersWithClientTransfer() {
    const targetProfiles = profiles.filter((profile) =>
      deactivationTargetIds.includes(profile.id)
    );

    if (targetProfiles.length === 0) {
      setDeactivationModalOpen(false);
      return;
    }

    const shouldUnassignClients = reassignClientsToUserId === "unassigned";
    const nextOwnerId = shouldUnassignClients ? null : reassignClientsToUserId;

    const confirmed = window.confirm(
      `Czy na pewno chcesz dezaktywować użytkowników?\n\nLiczba użytkowników: ${targetProfiles.length}\nKlienci zostaną ${shouldUnassignClients ? "pozostawieni jako nieprzypisani" : "przepisani do wybranego użytkownika"}.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingDeactivation(true);

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      for (const profile of targetProfiles) {
        const { data: clientsBeforeTransfer, error: clientsReadError } = await supabase
          .from("clients")
          .select("id, assigned_to, assigned_user_id")
          .or(`assigned_to.eq.${profile.id},assigned_user_id.eq.${profile.id}`);

        if (clientsReadError) {
          console.error("Błąd pobierania klientów przed dezaktywacją", clientsReadError);
          alert(`Nie udało się pobrać klientów użytkownika ${profile.display_name || profile.email || profile.id}.`);
          return;
        }

        const { error: logError } = await supabase.from("user_deactivation_logs").insert({
          user_id: profile.id,
          display_name: profile.display_name,
          email: profile.email,
          role: profile.role,
          manager_id: profile.manager_id,
          previous_is_active: profile.is_active ?? true,
          previous_hidden_from_assignment: profile.hidden_from_assignment ?? false,
          transferred_to_user_id: nextOwnerId,
          clients_snapshot: clientsBeforeTransfer || [],
          deactivated_by: currentUser?.id || null,
        });

        if (logError) {
          console.error("Błąd zapisu logu dezaktywacji", logError);
          alert(`Nie udało się zapisać logu dezaktywacji użytkownika ${profile.display_name || profile.email || profile.id}.`);
          return;
        }

        const { error: clientsUpdateError } = await supabase
          .from("clients")
          .update({
            assigned_to: nextOwnerId,
            assigned_user_id: nextOwnerId,
          })
          .or(`assigned_to.eq.${profile.id},assigned_user_id.eq.${profile.id}`);

        if (clientsUpdateError) {
          console.error("Błąd przepisywania klientów użytkownika", clientsUpdateError);
          alert(`Nie udało się przepisać klientów użytkownika ${profile.display_name || profile.email || profile.id}.`);
          return;
        }

        await updateProfile(profile.id, {
          is_active: false,
          hidden_from_assignment: true,
        });
      }

      setSelectedProfileIds([]);
      setDeactivationTargetIds([]);
      setReassignClientsToUserId("unassigned");
      setReassignUserSearch("");
      setDeactivationModalOpen(false);
      await loadProfiles();
    } finally {
      setProcessingDeactivation(false);
    }
  }

  async function activateSelectedProfiles() {
    const profilesToActivate = profiles.filter((profile) =>
      selectedProfileIds.includes(profile.id)
    );

    if (profilesToActivate.length === 0) {
      alert("Zaznacz użytkowników do włączenia.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz włączyć zaznaczonych użytkowników?\n\nLiczba użytkowników: ${profilesToActivate.length}`
    );

    if (!confirmed) {
      return;
    }

    for (const profile of profilesToActivate) {
      await updateProfile(profile.id, {
        is_active: true,
        hidden_from_assignment: false,
      });
    }

    setSelectedProfileIds([]);
  }

  async function restoreSelectedProfilesFromDeactivationLog() {
    const profilesToRestore = profiles.filter((profile) =>
      selectedProfileIds.includes(profile.id)
    );

    if (profilesToRestore.length === 0) {
      alert("Zaznacz użytkowników do przywrócenia.");
      return;
    }

    const inactiveProfiles = profilesToRestore.filter(
      (profile) => profile.is_active === false
    );

    if (inactiveProfiles.length === 0) {
      alert("Zaznaczeni użytkownicy są już aktywni.");
      return;
    }

    const confirmed = window.confirm(
      `Czy przywrócić zaznaczonych użytkowników i oddać im klientów z ostatniej dezaktywacji?\n\nLiczba użytkowników: ${inactiveProfiles.length}`
    );

    if (!confirmed) {
      return;
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    for (const profile of inactiveProfiles) {
      const { data: log, error: logError } = await supabase
        .from("user_deactivation_logs")
        .select("id, clients_snapshot, previous_hidden_from_assignment")
        .eq("user_id", profile.id)
        .is("restored_at", null)
        .order("deactivated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logError) {
        console.error("Błąd pobierania logu dezaktywacji", logError);
        alert(`Nie udało się pobrać logu dezaktywacji użytkownika ${profile.display_name || profile.email || profile.id}.`);
        return;
      }

      if (!log) {
        alert(`Brak aktywnego logu dezaktywacji dla użytkownika ${profile.display_name || profile.email || profile.id}.`);
        continue;
      }

      const clientsSnapshot = Array.isArray(log.clients_snapshot)
        ? log.clients_snapshot
        : [];

      const snapshotClientIds = clientsSnapshot
        .map((client: any) => client?.id)
        .filter(Boolean);

      if (snapshotClientIds.length > 0) {
        const { data: currentClients, error: currentClientsError } = await supabase
          .from("clients")
          .select("id, full_name, assigned_user_id")
          .in("id", snapshotClientIds);

        if (currentClientsError) {
          console.error("Błąd sprawdzania aktualnych właścicieli klientów", currentClientsError);
          alert("Nie udało się sprawdzić aktualnych właścicieli klientów.");
          return;
        }

        const conflictingClients = (currentClients || []).filter(
          (client: any) =>
            client.assigned_user_id &&
            client.assigned_user_id !== profile.id
        );

        if (conflictingClients.length > 0) {
          const currentClientsById = new Map(
            (currentClients || []).map((client: any) => [client.id, client])
          );

          setRestoreConflictProfile(profile);
          setRestoreConflictLogId(log.id);
          setRestoreClientChoices(
            clientsSnapshot.map((snapshot: any) => {
              const currentClient: any = currentClientsById.get(snapshot.id);

              return {
                id: snapshot.id,
                full_name: currentClient?.full_name || null,
                assigned_user_id: currentClient?.assigned_user_id || null,
                previous_assigned_to: snapshot.assigned_to ?? null,
                previous_assigned_user_id: snapshot.assigned_user_id ?? null,
                restore: true,
              };
            })
          );
          setRestoreConflictModalOpen(true);
          return;
        }
      }

      for (const clientSnapshot of clientsSnapshot) {
        if (!clientSnapshot?.id) {
          continue;
        }

        const { error: clientRestoreError } = await supabase
          .from("clients")
          .update({
            assigned_to: clientSnapshot.assigned_to ?? null,
            assigned_user_id: clientSnapshot.assigned_user_id ?? null,
          })
          .eq("id", clientSnapshot.id);

        if (clientRestoreError) {
          console.error("Błąd przywracania klienta po dezaktywacji", clientRestoreError);
          alert("Nie udało się przywrócić jednego z klientów. Sprawdź konsolę.");
          return;
        }
      }

      await updateProfile(profile.id, {
        is_active: true,
        hidden_from_assignment: log.previous_hidden_from_assignment ?? false,
        password_reset_required: true,
      } as Partial<Profile>);

      const { error: restoredLogError } = await supabase
        .from("user_deactivation_logs")
        .update({
          restored_at: new Date().toISOString(),
          restored_by: currentUser?.id || null,
        })
        .eq("id", log.id);

      if (restoredLogError) {
        console.error("Błąd oznaczania logu jako przywróconego", restoredLogError);
      }
    }

    setSelectedProfileIds([]);
    await loadProfiles();
    alert("Przywracanie zakończone.");
  }

  async function confirmRestoreSelectedClientsFromModal() {
    if (!restoreConflictProfile || !restoreConflictLogId) {
      return;
    }

    const selectedClients = restoreClientChoices.filter((client) => client.restore);

    const confirmed = window.confirm(
      `Przywrócić zaznaczonych klientów użytkownikowi ${restoreConflictProfile.display_name || restoreConflictProfile.email}?\n\nLiczba klientów: ${selectedClients.length}\nOdznaczeni klienci zostaną u obecnych opiekunów.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingRestoreSelection(true);

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      for (const client of selectedClients) {
        const { error: clientRestoreError } = await supabase
          .from("clients")
          .update({
            assigned_to: client.previous_assigned_to ?? null,
            assigned_user_id: client.previous_assigned_user_id ?? null,
          })
          .eq("id", client.id);

        if (clientRestoreError) {
          console.error("Błąd przywracania wybranego klienta", clientRestoreError);
          alert("Nie udało się przywrócić jednego z wybranych klientów. Sprawdź konsolę.");
          return;
        }
      }

      await updateProfile(restoreConflictProfile.id, {
        is_active: true,
        hidden_from_assignment: false,
        password_reset_required: true,
      } as Partial<Profile>);

      const { error: restoredLogError } = await supabase
        .from("user_deactivation_logs")
        .update({
          restored_at: new Date().toISOString(),
          restored_by: currentUser?.id || null,
        })
        .eq("id", restoreConflictLogId);

      if (restoredLogError) {
        console.error("Błąd oznaczania logu jako przywróconego", restoredLogError);
      }

      setRestoreConflictModalOpen(false);
      setRestoreConflictProfile(null);
      setRestoreConflictLogId(null);
      setRestoreClientChoices([]);
      setSelectedProfileIds([]);
      await loadProfiles();
      alert("Przywracanie zakończone.");
    } finally {
      setProcessingRestoreSelection(false);
    }
  }

  function resetPasswordForSelectedProfile() {
    if (selectedProfileIds.length !== 1) {
      alert("Reset hasła można wykonać tylko dla jednego zaznaczonego użytkownika.");
      return;
    }

    setResetPasswordUserId(selectedProfileIds[0]);
    setResetPasswordValue("");
    setResetPasswordConfirmValue("");
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

  const filteredProfiles = profiles
    .filter((profile) => {
      const search = searchTerm.toLowerCase().trim();

      if (!search) return true;

      return (
        profile.user_number.toString().includes(search) ||
        (profile.display_name || "")
          .toLowerCase()
          .includes(search) ||
        (profile.email || "")
          .toLowerCase()
          .includes(search) ||
        profile.role.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "user_number") {
        return (a.user_number - b.user_number) * direction;
      }

      if (sortConfig.key === "display_name") {
        return ((a.display_name || "").localeCompare(
          b.display_name || "",
          "pl",
          {
            sensitivity: "base",
          }
        )) * direction;
      }

      if (sortConfig.key === "role") {
        return a.role.localeCompare(b.role, "pl") * direction;
      }

      return 0;
    });

  function toggleSort(
    key: "user_number" | "display_name" | "role"
  ) {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc"
          ? "desc"
          : "asc",
    }));
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
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Admin
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Panel zarządzania
              </h1>
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveSection("users")}
                className={
                  activeSection === "users"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    : "rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
                }
              >
                Użytkownicy
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("tags")}
                className={
                  activeSection === "tags"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    : "rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
                }
              >
                Tagi klientów
              </button>

              <button
                type="button"
                onClick={() => setActiveSection("pricing")}
                className={
                  activeSection === "pricing"
                    ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    : "rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
                }
              >
                Kalkulator
              </button>
            </div>
          </div>
            {activeSection === "users" && (
              <>
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
              </>
            )}

            {activeSection === "tags" && (
              <>
          {/* --- Client Tags Admin Section --- */}
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Tagi klientów
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Tagi dostępne do przypisywania na kartach klientów. Użytkownicy będą mogli wybierać tylko tagi aktywne z tej listy.
                </p>
              </div>

              <button
                type="button"
                onClick={loadClientTags}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Odśwież tagi
              </button>
            </div>

            {tagTableMissing ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Brakuje tabeli <strong>client_tags</strong> w Supabase. Po wykonaniu SQL sekcja zacznie działać automatycznie.
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
              <input
                type="text"
                placeholder="Nazwa tagu, np. VIP"
                value={newTag.name}
                onChange={(e) =>
                  setNewTag((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              />

              <select
                value={newTag.color}
                onChange={(e) =>
                  setNewTag((current) => ({
                    ...current,
                    color: e.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              >
                <option value="slate">Szary</option>
                <option value="blue">Niebieski</option>
                <option value="emerald">Zielony</option>
                <option value="amber">Pomarańczowy</option>
                <option value="red">Czerwony</option>
                <option value="purple">Fioletowy</option>
              </select>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newTag.is_system}
                  onChange={(e) =>
                    setNewTag((current) => ({
                      ...current,
                      is_system: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Tag systemowy
              </label>

              <button
                type="button"
                onClick={createClientTag}
                disabled={creatingTag || tagTableMissing}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingTag ? "Dodawanie..." : "Dodaj tag"}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
              {loadingTags ? (
                <div className="p-5 text-sm text-slate-500">Ładowanie tagów...</div>
              ) : clientTags.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">
                  Brak tagów klientów.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {clientTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                          {tag.name}
                        </span>

                        <span className="text-xs text-slate-400">
                          kolor: {tag.color || "slate"}
                        </span>

                        {tag.is_system ? (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                            systemowy
                          </span>
                        ) : null}

                        <span
                          className={
                            (tag.is_active ?? true)
                              ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                              : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500"
                          }
                        >
                          {(tag.is_active ?? true) ? "aktywny" : "wyłączony"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleClientTagActive(tag)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {(tag.is_active ?? true) ? "Wyłącz" : "Włącz"}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteClientTag(tag)}
                          disabled={Boolean(tag.is_system)}
                          title={tag.is_system ? "Tag systemowy można tylko wyłączyć" : "Usuń tag"}
                          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
              </>
            )}

            {activeSection === "pricing" && (
              <AdminPanel
                adminStatus={adminStatus}
                pricingOverrides={pricingOverrides}
                updatePricingValue={updatePricingValue}
                savePricingSettings={savePricingSettings}
                resetPricingOverrides={resetPricingOverrides}
              />
            )}

            {activeSection === "users" && (
              <>

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <input
                type="text"
                placeholder="Szukaj po UID, nazwisku, emailu, roli..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Wyniki: {filteredProfiles.length}</span>
              <span>•</span>
              <span>Zaznaczono: {selectedProfileIds.length}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              onClick={saveSelectedProfileChanges}
              disabled={selectedProfileIds.length === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Zapisz zaznaczonych
            </button>

            <button
              type="button"
              onClick={deactivateSelectedProfiles}
              disabled={selectedProfileIds.length === 0}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Wyłącz zaznaczonych
            </button>

            <button
              type="button"
              onClick={activateSelectedProfiles}
              disabled={selectedProfileIds.length === 0}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Włącz zaznaczonych
            </button>

            <button
              type="button"
              onClick={restoreSelectedProfilesFromDeactivationLog}
              disabled={selectedProfileIds.length === 0}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Przywróć z logu
            </button>

            <button
              type="button"
              onClick={resetPasswordForSelectedProfile}
              disabled={selectedProfileIds.length !== 1}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset hasła
            </button>
          </div>
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              Ładowanie użytkowników...
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[1150px] divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-sm font-semibold text-slate-600">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          filteredProfiles.length > 0 &&
                          filteredProfiles.every((profile) =>
                            selectedProfileIds.includes(profile.id)
                          )
                        }
                        onChange={toggleAllVisibleProfiles}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("user_number")}
                        className="flex items-center gap-2 font-semibold text-slate-600 transition hover:text-slate-900"
                      >
                        UID
                        <span className="text-xs">
                          {sortConfig.key === "user_number"
                            ? sortConfig.direction === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("display_name")}
                        className="flex items-center gap-2 font-semibold text-slate-600 transition hover:text-slate-900"
                      >
                        Użytkownik
                        <span className="text-xs">
                          {sortConfig.key === "display_name"
                            ? sortConfig.direction === "asc"
                              ? "A-Z"
                              : "Z-A"
                            : "↕"}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("role")}
                        className="flex items-center gap-2 font-semibold text-slate-600 transition hover:text-slate-900"
                      >
                        Rola
                        <span className="text-xs">
                          {sortConfig.key === "role"
                            ? sortConfig.direction === "asc"
                              ? "A-Z"
                              : "Z-A"
                            : "↕"}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3">Manager</th>
                    <th className="px-4 py-3">
  Widoczny w przypisaniach
</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredProfiles.map((profile) => {
                    const isSeller = profile.role === "seller";
                    const editedProfile = editedProfiles[profile.id] || {};

                    return (
                      <tr
                        key={profile.id}
                        className={
                          editedProfiles[profile.id]
                            ? "bg-amber-50"
                            : profile.is_active === false
                              ? "bg-red-50"
                              : undefined
                        }
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedProfileIds.includes(profile.id)}
                            onChange={() => toggleSelectedProfile(profile.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="inline-flex min-w-[56px] items-center justify-center rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                            #{profile.user_number}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            value={editedProfile.display_name ?? profile.display_name ?? ""}
                            onChange={(e) => {
                              updateEditedProfile(profile.id, {
                                display_name: e.target.value,
                              });
                            }}
                            className={
                              profile.is_active === false
                                ? "min-w-[180px] w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 outline-none focus:border-red-400"
                                : "min-w-[180px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                            }
                          />
                          {profile.is_active === false && (
                            <div className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                              NIEAKTYWNY
                            </div>
                          )}
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
                            className="min-w-[280px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                          />
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
  <button
    type="button"
    onClick={() => {
      const currentlyVisible =
        editedProfile.hidden_from_assignment !== undefined
          ? !editedProfile.hidden_from_assignment
          : !(profile.hidden_from_assignment ?? false);

      updateEditedProfile(profile.id, {
        hidden_from_assignment: currentlyVisible,
      });
    }}
    title={
      (editedProfile.hidden_from_assignment !== undefined
        ? !editedProfile.hidden_from_assignment
        : !(profile.hidden_from_assignment ?? false))
        ? "Widoczny w przypisaniach"
        : "Ukryty w przypisaniach"
    }
    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
  >
    {(editedProfile.hidden_from_assignment !== undefined
      ? !editedProfile.hidden_from_assignment
      : !(profile.hidden_from_assignment ?? false)) ? (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ) : (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
        <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a17.8 17.8 0 0 1-3.1 4.3" />
        <path d="M6.1 6.1C3.5 7.9 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 5.9-1.8" />
      </svg>
    )}
  </button>
</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
              </>
            )}
        </div>
      </div>
      {restoreConflictModalOpen && restoreConflictProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Wybierz klientów do przywrócenia
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Część klientów z historycznej bazy użytkownika jest obecnie przypisana do innych handlowców. Zaznacz, których klientów oddać użytkownikowi {restoreConflictProfile.display_name || restoreConflictProfile.email}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRestoreConflictModalOpen(false)}
                disabled={processingRestoreSelection}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Zamknij
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setRestoreClientChoices((current) =>
                    current.map((client) => ({ ...client, restore: true }))
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Zaznacz wszystkich
              </button>

              <button
                type="button"
                onClick={() =>
                  setRestoreClientChoices((current) =>
                    current.map((client) => ({ ...client, restore: false }))
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Odznacz wszystkich
              </button>
            </div>

            <div className="mt-5 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {restoreClientChoices.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">
                  Brak klientów do wyboru.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {restoreClientChoices.map((client) => {
                    const currentOwner = profiles.find(
                      (profile) => profile.id === client.assigned_user_id
                    );

                    return (
                      <label
                        key={client.id}
                        className="flex cursor-pointer items-start gap-3 px-5 py-4 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={client.restore}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setRestoreClientChoices((current) =>
                              current.map((item) =>
                                item.id === client.id
                                  ? { ...item, restore: checked }
                                  : item
                              )
                            );
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {client.full_name || client.id}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Obecnie: {currentOwner?.display_name || currentOwner?.email || client.assigned_user_id || "nieprzypisany"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRestoreConflictModalOpen(false)}
                disabled={processingRestoreSelection}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={confirmRestoreSelectedClientsFromModal}
                disabled={processingRestoreSelection || restoreClientChoices.length === 0}
                className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {processingRestoreSelection ? "Przywracanie..." : "Przywróć zaznaczonych klientów"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deactivationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Dezaktywuj użytkownika
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Wybierz, co zrobić z klientami przypisanymi do dezaktywowanego użytkownika.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeactivationModalOpen(false)}
                disabled={processingDeactivation}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Zamknij
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">Dezaktywowani użytkownicy:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profiles
                  .filter((profile) => deactivationTargetIds.includes(profile.id))
                  .map((profile) => (
                    <span key={profile.id} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-red-700">
                      {profile.display_name || profile.email || "Użytkownik"} #{profile.user_number}
                    </span>
                  ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                Wybierz komu przypisać klientów po dezaktywowanym użytkowniku
              </label>
              <input
                type="text"
                value={reassignUserSearch}
                onChange={(event) => setReassignUserSearch(event.target.value)}
                placeholder="Szukaj po imieniu, nazwisku, e-mailu lub UID..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              />
              <select
                value={reassignClientsToUserId}
                onChange={(event) => setReassignClientsToUserId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              >
                <option value="unassigned">Pozostaw nieprzypisanych</option>
                {profiles
                  .filter((profile) => !deactivationTargetIds.includes(profile.id))
                  .filter((profile) => profile.is_active !== false)
                  .filter((profile) => {
                    const query = reassignUserSearch.trim().toLowerCase();
                    if (!query) return true;

                    return [profile.display_name, profile.email, String(profile.user_number), profile.role]
                      .filter(Boolean)
                      .some((value) => String(value).toLowerCase().includes(query));
                  })
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.display_name || profile.email || "Użytkownik"} #{profile.user_number} — {profile.role}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeactivationModalOpen(false)}
                disabled={processingDeactivation}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={confirmDeactivateUsersWithClientTransfer}
                disabled={processingDeactivation}
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processingDeactivation ? "Dezaktywacja..." : "Dezaktywuj użytkownika"}
              </button>
            </div>
          </div>
        </div>
      )}
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