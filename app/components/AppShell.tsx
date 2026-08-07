"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  emitCrmResume,
  type CrmResumeReason,
} from "@/lib/useCrmResumeRefresh";
import AppHeader from "@/app/components/AppHeader";
import {
  getAuditContextFromPath,
  getCrmAuditSessionId,
  recordCrmAuditEvent,
} from "@/lib/crmAudit";

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
const CRM_RESUME_MIN_BACKGROUND_MS = 1500;
const CRM_RESUME_THROTTLE_MS = 5000;
const CRM_SESSION_REFRESH_MARGIN_MS = 2 * 60 * 1000;

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
  const backgroundedAtRef = useRef<number | null>(null);
  const lastResumeAtRef = useRef(0);
  const resumeInFlightRef = useRef(false);
  const lastAuditedPathRef = useRef("");
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

  useEffect(() => {
    if (isCalculatorApp || !isLoggedIn || !pathname) return;

    const sessionId = getCrmAuditSessionId();

    if (!sessionId) return;

    const sessionStartedKey = `ideasol:crm-audit-started:${sessionId}`;

    if (!window.sessionStorage.getItem(sessionStartedKey)) {
      window.sessionStorage.setItem(sessionStartedKey, new Date().toISOString());
      void recordCrmAuditEvent({
        eventType: "session_started",
        action: "login",
        module: "crm",
        summary: "Użytkownik wszedł do CRM",
        path: pathname,
        sessionId,
      });
    }

    if (lastAuditedPathRef.current === pathname) return;
    lastAuditedPathRef.current = pathname;

    const context = getAuditContextFromPath(pathname);
    void recordCrmAuditEvent({
      eventType: "page_view",
      action: "view",
      module: context.moduleName,
      summary: `Otwarto widok ${pathname}`,
      path: pathname,
      clientId: context.clientId,
      saleId: context.saleId,
      offerId: context.offerId,
      sessionId,
      metadata: {
        page_title: document.title,
      },
    });
  }, [isCalculatorApp, isLoggedIn, pathname]);

  useEffect(() => {
    if (isCalculatorApp) return;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function markAsBackgrounded() {
      if (backgroundedAtRef.current === null) {
        backgroundedAtRef.current = Date.now();
      }
    }

    async function recoverCrm(reason: CrmResumeReason, isRetry = false) {
      if (document.visibilityState === "hidden") return;

      const now = Date.now();
      const backgroundedAt = backgroundedAtRef.current;
      const wasActuallyBackgrounded =
        backgroundedAt !== null &&
        now - backgroundedAt >= CRM_RESUME_MIN_BACKGROUND_MS;

      if (reason !== "online" && !wasActuallyBackgrounded) {
        return;
      }

      if (
        resumeInFlightRef.current ||
        (!isRetry && now - lastResumeAtRef.current < CRM_RESUME_THROTTLE_MS)
      ) {
        return;
      }

      resumeInFlightRef.current = true;
      lastResumeAtRef.current = now;

      try {
        const {
          data: { session: storedSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        let activeSession = storedSession;
        const expiresAtMs = (storedSession?.expires_at || 0) * 1000;
        const shouldRefreshSession =
          Boolean(storedSession?.refresh_token) &&
          expiresAtMs > 0 &&
          expiresAtMs <= Date.now() + CRM_SESSION_REFRESH_MARGIN_MS;

        if (shouldRefreshSession) {
          const {
            data: { session: refreshedSession },
            error: refreshError,
          } = await supabase.auth.refreshSession();

          if (refreshError) {
            throw refreshError;
          }

          activeSession = refreshedSession;
        }

        if (!activeSession?.user) {
          setIsLoggedIn(false);

          if (pathname !== "/") {
            router.replace("/");
          }

          return;
        }

        setIsLoggedIn(true);
        backgroundedAtRef.current = null;
        emitCrmResume(reason);
        const context = getAuditContextFromPath(pathname || "/");
        void recordCrmAuditEvent({
          eventType: "session_resumed",
          action: "resume",
          module: context.moduleName,
          summary: "Użytkownik wrócił do aktywnej sesji CRM",
          path: pathname || "/",
          clientId: context.clientId,
          saleId: context.saleId,
          offerId: context.offerId,
          sessionId: getCrmAuditSessionId(),
          metadata: {
            reason,
            background_duration_ms:
              backgroundedAt === null ? null : Math.max(0, now - backgroundedAt),
          },
        });
      } catch (error) {
        console.error("Nie udało się wznowić sesji CRM:", error);

        if (!isRetry) {
          retryTimer = setTimeout(() => {
            resumeInFlightRef.current = false;
            void recoverCrm(reason, true);
          }, 1200);
          return;
        }
      } finally {
        if (!retryTimer || isRetry) {
          resumeInFlightRef.current = false;
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        markAsBackgrounded();
        return;
      }

      void recoverCrm("visibility");
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted || backgroundedAtRef.current !== null) {
        void recoverCrm("pageshow");
      }
    }

    function handleFocus() {
      void recoverCrm("focus");
    }

    function handleOnline() {
      void recoverCrm("online");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", markAsBackgrounded);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("blur", markAsBackgrounded);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", markAsBackgrounded);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("blur", markAsBackgrounded);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);

      if (retryTimer) {
        clearTimeout(retryTimer);
      }
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
