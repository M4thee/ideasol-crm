import type { Metadata } from "next";
import IdeaSignFlow from "@/components/ideasign/IdeaSignFlow";

export const metadata: Metadata = {
  title: "IdeaSign — bezpieczne zawieranie umów",
  description: "Bezpieczny portal elektronicznego zawierania umów IdeaSol.",
  robots: { index: false, follow: false, nocache: true },
};

export default function IdeaSignPage() {
  return <IdeaSignFlow />;
}

