"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/app/components/AppHeader";

type AppShellProps = {
  children: React.ReactNode;
};

type OfflineSyncBannerState = {
  status: "syncing" | "completed";
  message: string;
};

type OfflineSyncStatusPayload = OfflineSyncBannerState & {
  updatedAt: string;
};

const OFFLINE_SYNC_STATUS_KEY = "ideasol:offlineSyncStatus:v1";

function readOfflineSyncStatus() {
  if (typeof window === "undefined") return null as OfflineSyncStatusPayload | null;

  try {
    const rawValue = window.localStorage.getItem(OFFLINE_SYNC_STATUS_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as OfflineSyncStatusPayload;

    if (!parsedValue?.status || !parsedValue?.message) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

export default function AppShell({ children }: AppShellProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [offlineSyncBanner, setOfflineSyncBanner] = useState<OfflineSyncBannerState | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isCalculatorApp = pathname?.startsWith("/calculator-app");

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function showSyncStatus(payload: OfflineSyncStatusPayload | null) {
      if (!payload) return;

      const ageMs = Date.now() - new Date(payload.updatedAt).getTime();

      if (payload.status === "completed" && ageMs > 5000) {
        return;
      }

      setOfflineSyncBanner({
        status: payload.status,
        message: payload.message,
      });

      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      if (payload.status === "completed") {
        hideTimer = setTimeout(() => {
          setOfflineSyncBanner(null);
        }, Math.max(0, 5000 - ageMs));
      }
    }

    showSyncStatus(readOfflineSyncStatus());

    function handleSyncStatus(event: Event) {
      const customEvent = event as CustomEvent<OfflineSyncStatusPayload>;
      showSyncStatus(customEvent.detail);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== OFFLINE_SYNC_STATUS_KEY) {
        return;
      }

      showSyncStatus(readOfflineSyncStatus());
    }

    window.addEventListener("ideasol:offline-sync-status", handleSyncStatus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("ideasol:offline-sync-status", handleSyncStatus);
      window.removeEventListener("storage", handleStorage);

      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (isCalculatorApp) {
      setIsLoggedIn(true);
      return;
    }

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

        const hasUser = Boolean(session?.user);

        setIsLoggedIn(hasUser);

        if (!hasUser && pathname !== "/") {
          router.replace("/");
        }
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

        if (pathname !== "/") {
          router.replace("/");
        }

        return;
      }

      if (session?.user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);

        if (pathname !== "/") {
          router.replace("/");
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isCalculatorApp, pathname, router]);

  if (isCalculatorApp) {
    return (
      <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 text-slate-950">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-100 text-slate-950">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-5 lg:p-6">
        {isLoggedIn ? <AppHeader /> : null}
        {offlineSyncBanner && (
          <div
            className={`mb-4 rounded-3xl border p-4 text-sm font-semibold shadow-sm ${offlineSyncBanner.status === "syncing"
              ? "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
              }`}
          >
            {offlineSyncBanner.message}
          </div>
        )}
        <div className="w-full overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}