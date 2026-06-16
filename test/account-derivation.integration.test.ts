import { WorkflowBuilder, JobBuilder, ChainId, serialize, getChainConfig } from '../src';
import { Workflow } from '../src';
import { addressToEmptyAccount, createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getEntryPoint, KERNEL_V3_3 } from '@zerodev/sdk/constants';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';

// End-to-end regression for the v4 non-deterministic account-derivation bug.
// Needs a reachable RPC, so it is gated behind DITTO_IPFS_SERVICE_URL (the SDK derives
// rpcUrl as `${ipfsServiceUrl}/bundler/${chainId}`). All calls are read-only address
// derivation (eth_call) — no gas, no submission. Run with:
//   DITTO_IPFS_SERVICE_URL=http://46.101.223.202:8080 npm test
const IPFS_SERVICE_URL = process.env.DITTO_IPFS_SERVICE_URL;
const EXECUTOR = '0xE295E078f233D48e5C734207EAe043Dd4FDf95f7' as const;
// Throwaway, well-known test key (anvil/hardhat #0). NOT a production owner key.
const TEST_OWNER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const CHAINLINK_FEED = '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1' as const;
const ANCHOR = 1_700_000_000_000;

function decodeSessionAccount(sessionStr: string): string {
  const base64 = sessionStr.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  return (decoded.accountParams.accountAddress as string).toLowerCase();
}

const maybe = IPFS_SERVICE_URL ? describe : describe.skip;

maybe('v4 account derivation determinism (integration — needs DITTO_IPFS_SERVICE_URL)', () => {
  const owner = privateKeyToAccount(TEST_OWNER_KEY);

  function makeWorkflow(validAfterMs: number, validUntilMs: number): Workflow {
    const wf = WorkflowBuilder.create(addressToEmptyAccount(owner.address))
      .addCronTrigger('*/2 * * * *')
      .setCount(5)
      .setInterval(120)
      .setValidAfter(new Date(validAfterMs))
      .setValidUntil(new Date(validUntilMs))
      .addJob(
        JobBuilder.create('job-1')
          .setChainId(ChainId.BASE_SEPOLIA)
          .addStep({ target: CHAINLINK_FEED, abi: 'latestRoundData()', args: [], value: BigInt(0) })
          .build(),
      )
      .build();
    wf.typify();
    return wf;
  }

  test('serialize() yields the same session account regardless of the validity window', async () => {
    const a = await serialize(makeWorkflow(ANCHOR, ANCHOR + 60 * 60 * 1000), EXECUTOR, owner, false, IPFS_SERVICE_URL!);
    const b = await serialize(
      makeWorkflow(ANCHOR + 9_999 * 1000, ANCHOR + 7 * 24 * 60 * 60 * 1000),
      EXECUTOR, owner, false, IPFS_SERVICE_URL!,
    );

    const accA = decodeSessionAccount(a.data.workflow.jobs[0].session);
    const accB = decodeSessionAccount(b.data.workflow.jobs[0].session);

    expect(accB).toEqual(accA);
  });

  test('session account (executing) === createWorkflow sender (registering)', async () => {
    const { data, initConfigs } = await serialize(
      makeWorkflow(ANCHOR, ANCHOR + 60 * 60 * 1000), EXECUTOR, owner, false, IPFS_SERVICE_URL!,
    );
    const sessionAccount = decodeSessionAccount(data.workflow.jobs[0].session);

    // Replicate WorkflowContract.createWorkflow's account derivation (same initConfig + owner).
    const job = data.workflow.jobs[0];
    const cfg = getChainConfig(IPFS_SERVICE_URL!)[job.chainId];
    const publicClient = createPublicClient({ transport: http(cfg.rpcUrl), chain: cfg.chain });
    const entryPoint = getEntryPoint('0.7');
    const ownerValidator = await signerToEcdsaValidator(publicClient, { entryPoint, signer: owner, kernelVersion: KERNEL_V3_3 });
    const registering = await createKernelAccount(publicClient, {
      plugins: { sudo: ownerValidator },
      entryPoint,
      kernelVersion: KERNEL_V3_3,
      initConfig: initConfigs.get(job.chainId),
    });

    expect(registering.address.toLowerCase()).toEqual(sessionAccount);
  });
});
