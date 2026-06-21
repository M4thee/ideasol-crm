"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;

type UserProfile = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  role?: string | null;
  default_seller_markup?: number | null;
};

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingMargin, setSavingMargin] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [marginInput, setMarginInput] = useState("0");
  const [marginStatus, setMarginStatus] = useState("");
  const [marginError, setMarginError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, role, default_seller_markup")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Błąd ładowania ustawień konta:", error);
    }

    const profileFromDb = data as UserProfile | null;

    const loadedProfile = {
      ...(profileFromDb || {}),
      id: user.id,
      email: profileFromDb?.email || user.email,
      default_seller_markup:
        profileFromDb?.default_seller_markup ?? 0,
    } as UserProfile;

    setProfile(loadedProfile);
    setMarginInput(String(loadedProfile.default_seller_markup || 0));
    setLoading(false);
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordStatus("");

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const accountEmail = profile?.email || authUser?.email || "";

    if (!accountEmail) {
      setPasswordError("Nie udało się ustalić adresu e-mail konta.");
      return;
    }

    if (!currentPassword.trim()) {
      setPasswordError("Wpisz aktualne hasło.");
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      setPasswordError(
        "Nowe hasło musi mieć minimum 10 znaków, 1 małą literę, 1 dużą literę, 1 cyfrę i 1 znak specjalny."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Nowe hasła nie są identyczne.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("Hasło musi być inne niż poprzednie.");
      return;
    }

    setSavingPassword(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: accountEmail,
      password: currentPassword,
    });

    if (signInError) {
      setPasswordError("Aktualne hasło jest nieprawidłowe.");
      setSavingPassword(false);
      return;
    }

    const {
      data: { user },
      error: updateError,
    } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Błąd zmiany hasła:", updateError);

      const message = updateError.message?.toLowerCase() || "";

      if (
        message.includes("same password") ||
        message.includes("different") ||
        message.includes("password should be different")
      ) {
        setPasswordError("Hasło musi być inne niż poprzednie.");
      } else {
        setPasswordError("Nie udało się zmienić hasła.");
      }

      setSavingPassword(false);
      return;
    }

    if (user?.id) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          password_changed_at: new Date().toISOString(),
          password_reset_required: false,
          password_reset_requested_at: null,
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Błąd zapisu daty zmiany hasła:", profileError);
      }
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordStatus("Hasło zostało zmienione.");
    setSavingPassword(false);
  }

  async function saveDefaultMargin() {
    setMarginError("");
    setMarginStatus("");

    if (!profile?.id) {
      setMarginError("Nie udało się ustalić użytkownika.");
      return;
    }

    const normalizedValue = Number(marginInput.replace(",", "."));

    if (!Number.isFinite(normalizedValue)) {
      setMarginError("Domyślna marża musi być liczbą.");
      return;
    }

    if (normalizedValue < 0) {
      setMarginError("Domyślna marża nie może być ujemna.");
      return;
    }

    setSavingMargin(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        default_seller_markup: normalizedValue,
      })
      .eq("id", profile.id);

    if (error) {
      console.error("Błąd zapisu domyślnej marży:", error);
      setMarginError("Nie udało się zapisać domyślnej marży.");
      setSavingMargin(false);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            default_seller_markup: normalizedValue,
          }
        : current
    );
    setMarginStatus("Domyślna marża została zapisana.");
    setSavingMargin(false);
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-slate-500">Ładowanie ustawień...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Konto
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Ustawienia konta
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Zarządzaj hasłem i ustawieniami kalkulatora.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Zmiana hasła</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hasło musi mieć minimum 10 znaków, małą i dużą literę, cyfrę oraz znak specjalny.
          </p>

          <div className="mt-5 grid gap-4">
            <input
              type="password"
              placeholder="Aktualne hasło"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />

            <input
              type="password"
              placeholder="Nowe hasło"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />

            <input
              type="password"
              placeholder="Powtórz nowe hasło"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />

            {passwordError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {passwordError}
              </div>
            )}

            {passwordStatus && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {passwordStatus}
              </div>
            )}

            <button
              type="button"
              onClick={changePassword}
              disabled={savingPassword}
              className="w-fit rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {savingPassword ? "Zapisywanie..." : "Zmień hasło"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">
            Domyślna marża kalkulatora
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ta wartość będzie automatycznie podstawiana w kalkulatorze wycen.
          </p>

          <div className="mt-5 max-w-md space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Domyślna marża
              </span>
              <input
                value={marginInput}
                onChange={(event) => setMarginInput(event.target.value)}
                placeholder="np. 5000"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            {marginError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {marginError}
              </div>
            )}

            {marginStatus && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {marginStatus}
              </div>
            )}

            <button
              type="button"
              onClick={saveDefaultMargin}
              disabled={savingMargin}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {savingMargin ? "Zapisywanie..." : "Zapisz domyślną marżę"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">
            Generator stopek mailowych
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Wygeneruj gotową stopkę mailową dla Outlook Online.
          </p>

          <div className="mt-5">
            <Link
              href="/signature-generator"
              className="inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
            >
              Otwórz generator stopek
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}