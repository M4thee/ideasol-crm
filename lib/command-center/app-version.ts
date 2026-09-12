export function getCommandCenterAppVersion() {
  return process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.VERCEL_URL
    || "development";
}
