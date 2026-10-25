/**
 * Decides whether Development Guest Preview is authorized.
 * Strict desktop security invariants:
 * - MUST be false in packaged production builds, even if the env variable is set.
 * - MUST be false in development mode if the explicit flag is absent or not "1".
 * - Enabled ONLY when unpackaged AND YCW_ENABLE_GUEST_PREVIEW === '1'.
 */
export function isGuestPreviewAllowed(
  isPackaged: boolean = false,
  envVal: string | undefined = process.env["YCW_ENABLE_GUEST_PREVIEW"],
): boolean {
  return !isPackaged && envVal === "1";
}
