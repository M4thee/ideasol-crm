import CommandCenterTv from "@/components/command-center/CommandCenterTv";

export default async function CommandCenterTvPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CommandCenterTv token={token} />;
}

