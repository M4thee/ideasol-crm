import CommandCenterTv from "@/components/command-center/CommandCenterTv";
import { getCommandCenterAppVersion } from "@/lib/command-center/app-version";

export default function CommandCenterTvPairingPage() {
  return <CommandCenterTv buildVersion={getCommandCenterAppVersion()} />;
}
