"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function updatePassword() {
    setError("");
    setSuccess("");

    if (!PASSWORD_REGEX.test(password)) {
      setError(
        "Hasło musi mieć minimum 8 znaków, 1 małą literę, 1 dużą literę, 1 cyfrę i 1 znak specjalny."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error,
    } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error(error);

      const message = error.message?.toLowerCase() || "";

      if (
        message.includes("same password") ||
        message.includes("different") ||
        message.includes("password should be different")
      ) {
        setError("Hasło musi być inne niż poprzednie.");
      } else {
        setError("Nie udało się zmienić hasła.");
      }

      setSaving(false);
      return;
    }

    if (user?.id) {
      const { error: profileError } = await supabase
        .from("user_profiles")
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

    setSuccess("Hasło zostało zmienione. Za chwilę nastąpi przekierowanie do logowania.");

    setTimeout(() => {
      router.push("/");
    }, 2500);

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Reset hasła
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Ustaw nowe hasło do konta CRM.
          </p>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Hasło musi zawierać minimum 8 znaków, dużą i małą literę,
            cyfrę oraz znak specjalny.
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Nowe hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900"
          />

          <input
            type="password"
            placeholder="Powtórz nowe hasło"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900"
          />

          {error && (
            <p className="text-sm font-medium text-red-500">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm font-medium text-emerald-600">
              {success}
            </p>
          )}

          <button
            type="button"
            onClick={updatePassword}
            disabled={saving}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white hover:bg-emerald-400 disabled:bg-slate-300 disabled:text-slate-500"
          >
            {saving ? "Zapisywanie..." : "Zmień hasło"}
          </button>
        </div>
      </section>
    </main>
  );
}