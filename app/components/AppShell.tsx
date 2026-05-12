"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/app/components/AppHeader";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Błąd pobierania sesji w AppShell:", error);
        }

        if (!mounted) return;

        setIsLoggedIn(Boolean(session?.user));
      } catch (error) {
        console.error("AppShell auth crash:", error);

        if (!mounted) return;

        setIsLoggedIn(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        return;
      }

      if (session?.user) {
        setIsLoggedIn(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-100 text-slate-950">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-5 lg:p-6">
        {isLoggedIn ? <AppHeader /> : null}
        <div className="w-full overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}