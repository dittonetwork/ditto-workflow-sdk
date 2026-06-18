import { ChainId, getChainConfig } from '../src';
import { ensureEnableModeForLegacySession } from '../src/utils/legacySession';
import { deserializePermissionAccount } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { getEntryPoint, KERNEL_V3_3 } from '@zerodev/sdk/constants';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

// Proves coexistence at the REAL deserialize layer: a single guarded code path reconstructs both a
// v3 (enable-mode, pre-#78 zerodev 5.5.9) and a v4 (initConfig/preinstalled, current) session.
// Needs a reachable RPC (deserialize does read-only chain calls) → gated on DITTO_IPFS_SERVICE_URL:
//   DITTO_IPFS_SERVICE_URL=http://46.101.223.202:8080 npm test
const IPFS = process.env.DITTO_IPFS_SERVICE_URL;
const maybe = IPFS ? describe : describe.skip;

function loadFixture(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8'));
}

maybe('dual-format deserialize (integration — needs DITTO_IPFS_SERVICE_URL)', () => {
  async function reconstruct(session: string) {
    const cfg = getChainConfig(IPFS!)[ChainId.BASE_SEPOLIA];
    const publicClient = createPublicClient({ transport: http(cfg.rpcUrl), chain: cfg.chain });
    const signer = await toECDSASigner({ signer: privateKeyToAccount(generatePrivateKey()) });
    // Exactly what WorkflowExecutor/WorkflowValidator now do at the deserialize site.
    return deserializePermissionAccount(
      publicClient, getEntryPoint('0.7'), KERNEL_V3_3,
      ensureEnableModeForLegacySession(session), signer,
    );
  }

  test('v3 (enable-mode) session reconstructs its account through the guarded path', async () => {
    const v3 = loadFixture('v3-session.json');
    const acct = await reconstruct(v3.session);
    expect(acct.address.toLowerCase()).toBe(v3.account.toLowerCase());
  });

  test('v4 (preinstalled) session reconstructs its account through the guarded path', async () => {
    const v4 = loadFixture('v4-session.json');
    const acct = await reconstruct(v4.session);
    expect(acct.address.toLowerCase()).toBe(v4.account.toLowerCase());
  });
});
