import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IdeaSignFlow from "@/components/ideasign/IdeaSignFlow";

export const metadata: Metadata = {
  title: "IdeaSign — lokalny podgląd",
  robots: { index: false, follow: false, nocache: true },
};

export default function IdeaSignDemoPage() {
  if (process.env.NODE_ENV === "production" && process.env.IDEASIGN_DEMO_ENABLED !== "true") {
    notFound();
  }
  return <IdeaSignFlow demo />;
}
