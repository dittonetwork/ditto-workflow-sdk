/**
 * v3/v4 session dual-format guard.
 *
 * Two on-chain session formats coexist after #78:
 *  - v4 (canonical initConfig): the permission plugin is pre-installed during the account's
 *    initialize(), so the session carries `isPreInstalled: true` and NO `enableSignature`.
 *  - v3 (pre-#78 enable-mode): the permission is installed via enable mode on first use, so the
 *    session carries an `enableSignature` (and historically no `isPreInstalled` field).
 *
 * ZeroDev's deserializePermissionAccount routes a session to enable mode iff `isPreInstalled` is
 * falsy (`pluginEnableSignature: isPreInstalled ? undefined : enableSignature`). A v3 session whose
 * stored `isPreInstalled` is (erroneously) `true` would wrongly route to preinstall mode, ignore the
 * `enableSignature`, and fail validation/execution on-chain.
 *
 * This guard restores the pre-#78 `forceEnableModeInSession` behavior, but GATED on the v3 marker
 * (presence of an `enableSignature`) so a v4 session is never mutated. v4 sessions are returned
 * byte-identical; v3 sessions are guaranteed to deserialize in enable mode.
 */
export function ensureEnableModeForLegacySession(sessionStr: string): string {
  let decoded: { isPreInstalled?: boolean; enableSignature?: string };
  try {
    const b64 = sessionStr.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return sessionStr; // not a decodable session — leave untouched
  }

  const isLegacyV3 =
    typeof decoded.enableSignature === 'string' &&
    decoded.enableSignature.length > 0 &&
    decoded.enableSignature !== '0x';

  // v4 / preinstalled (no enableSignature) — never touch it.
  if (!isLegacyV3) return sessionStr;
  // Already in enable mode — preserve the original bytes.
  if (decoded.isPreInstalled === false) return sessionStr;

  decoded.isPreInstalled = false;
  return Buffer.from(JSON.stringify(decoded))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
