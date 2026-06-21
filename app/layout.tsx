import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/app/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IdeaSol CRM",
  description: "",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IdeaSol Kalkulator",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

const themeInitScript = `
  (function () {
    try {
      var savedTheme = window.localStorage.getItem("ideasol_theme") || "auto";
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var shouldUseDark = savedTheme === "dark" || (savedTheme === "auto" && prefersDark);

      document.documentElement.classList.toggle("dark", shouldUseDark);
      document.documentElement.dataset.theme = savedTheme;
    } catch (error) {
      document.documentElement.classList.remove("dark");
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

const serviceWorkerRegistrationScript = `
  (function () {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function (error) {
        console.warn("Nie udało się zarejestrować service workera IdeaSol", error);
      });
    });
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-100 antialiased dark:bg-slate-950`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerRegistrationScript }} />
      </head>
      <body className="min-h-screen w-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
