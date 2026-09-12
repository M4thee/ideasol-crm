import CommandCenterTv from "@/components/command-center/CommandCenterTv";
import { getCommandCenterAppVersion } from "@/lib/command-center/app-version";

export default async function CommandCenterTvPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CommandCenterTv buildVersion={getCommandCenterAppVersion()} token={token} />;
}
