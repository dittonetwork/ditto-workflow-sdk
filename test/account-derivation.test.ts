import { WorkflowBuilder, JobBuilder, ChainId } from '../src';
import { Workflow } from '../src';
import { addressToEmptyAccount } from '@zerodev/sdk';
import { buildPolicies } from '../src/core/builders/PermissionBuilder';

const OWNER = '0x1111111111111111111111111111111111111111' as const;
// Base Sepolia Chainlink ETH/USD feed — an arbitrary call target.
const TARGET_A = '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1' as const;
const TARGET_B = '0x694AA1769357215DE4FAC081bf1f309aDC325306' as const;

function makeWorkflow(
  validAfterMs: number,
  validUntilMs: number,
  target: string = TARGET_A,
): Workflow {
  const wf = WorkflowBuilder.create(addressToEmptyAccount(OWNER))
    .addCronTrigger('*/2 * * * *')
    .setCount(5)
    .setInterval(120)
    // Pass Date objects so the builder's "must be in the future" guard (number path)
    // is bypassed — keeps these timestamps fixed and the test reproducible forever.
    .setValidAfter(new Date(validAfterMs))
    .setValidUntil(new Date(validUntilMs))
    .addJob(
      JobBuilder.create('job-1')
        .setChainId(ChainId.BASE_SEPOLIA)
        .addStep({ target: target as `0x${string}`, abi: 'latestRoundData()', args: [], value: BigInt(0) })
        .build(),
    )
    .build();
  wf.typify();
  return wf;
}

// The on-chain identity of the session permission validator: for each policy,
// (policyFlag+policyAddress) ++ policyData. This is exactly the byte material that
// feeds permissionId -> toInitConfig -> the CREATE2 Kernel account address. If this
// is byte-identical across two builds, the derived counterfactual account is identical.
function policyIdentity(policies: ReturnType<typeof buildPolicies>): string {
  return policies
    .map((p) => `${p.getPolicyInfoInBytes()}:${p.getPolicyData()}`)
    .join('|');
}

describe('v4 Kernel account derivation determinism', () => {
  // Fixed, deterministic anchor (Nov 2023). Never compared against Date.now().
  const ANCHOR = 1_700_000_000_000;

  test('account-determining policies are independent of the wall-clock validity window', () => {
    const wfEarly = makeWorkflow(ANCHOR, ANCHOR + 60 * 60 * 1000); // 1h window
    // Same logical workflow, "submitted" ~3.4h later with a 7-day window.
    const wfLate = makeWorkflow(ANCHOR + 12_345 * 1000, ANCHOR + 7 * 24 * 60 * 60 * 1000);

    const idEarly = policyIdentity(buildPolicies(wfEarly, true, wfEarly.jobs[0]));
    const idLate = policyIdentity(buildPolicies(wfLate, true, wfLate.jobs[0]));

    expect(idLate).toEqual(idEarly);
  });

  test('account-determining policies still depend on the call target (not over-removed)', () => {
    const wfA = makeWorkflow(ANCHOR, ANCHOR + 60 * 60 * 1000, TARGET_A);
    const wfB = makeWorkflow(ANCHOR, ANCHOR + 60 * 60 * 1000, TARGET_B);

    const idA = policyIdentity(buildPolicies(wfA, true, wfA.jobs[0]));
    const idB = policyIdentity(buildPolicies(wfB, true, wfB.jobs[0]));

    expect(idB).not.toEqual(idA);
  });
});
