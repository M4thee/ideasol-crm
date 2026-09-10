import { notFound } from "next/navigation";

import CommandCenterDemo from "@/components/command-center/CommandCenterDemo";

export default function CommandCenterDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CommandCenterDemo />;
}
