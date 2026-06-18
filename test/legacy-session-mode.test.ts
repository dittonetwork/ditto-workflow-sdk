import { ensureEnableModeForLegacySession } from '../src/utils/legacySession';
import * as fs from 'fs';
import * as path from 'path';

// base64url helpers (mirror the SDK/ZeroDev session encoding)
function decode(sessionStr: string): any {
  const b64 = sessionStr.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
}
function encode(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A real v3 (enable-mode) session produced by the pre-#78 SDK (zerodev permissions 5.5.9 / sdk 5.4.39):
// has an enableSignature and NO isPreInstalled field.
const v3 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'v3-session.json'), 'utf-8'),
);

describe('ensureEnableModeForLegacySession (v3/v4 dual-format guard)', () => {
  test('v3 session (has enableSignature) is forced to enable mode (isPreInstalled=false)', () => {
    const out = ensureEnableModeForLegacySession(v3.session);
    expect(decode(out).isPreInstalled).toBe(false);
  });

  test('v3 session keeps its enableSignature (enable mode still works)', () => {
    const out = ensureEnableModeForLegacySession(v3.session);
    expect(decode(out).enableSignature).toBe(decode(v3.session).enableSignature);
  });

  test('v3 session with a stale isPreInstalled=true is still forced to enable mode', () => {
    // Simulates an old-serialize quirk: enableSignature present but isPreInstalled mistakenly true.
    const tampered = encode({ ...decode(v3.session), isPreInstalled: true });
    const out = ensureEnableModeForLegacySession(tampered);
    expect(decode(out).isPreInstalled).toBe(false);
  });

  test('v4 session (isPreInstalled=true, no enableSignature) is returned UNCHANGED', () => {
    const v4 = encode({
      permissionParams: { policies: [] },
      accountParams: { accountAddress: '0x000000000000000000000000000000000000dEaD' },
      isPreInstalled: true,
    });
    expect(ensureEnableModeForLegacySession(v4)).toBe(v4); // byte-identical, never touched
  });

  test('non-session / undecodable input is returned unchanged (defensive)', () => {
    expect(ensureEnableModeForLegacySession('not-a-session')).toBe('not-a-session');
  });
});
