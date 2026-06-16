import { Workflow } from '../Workflow';
import { IWorkflowStorage } from '../../storage/IWorkflowStorage';
import { WorkflowContract } from '../../contracts/WorkflowContract';
import { serialize } from '../builders/WorkflowSerializer';
import { Signer } from "@zerodev/sdk/types";
import { UserOperationReceipt } from 'viem/account-abstraction';
import { getDittoWFRegistryAddress } from '../../utils/chainConfigProvider';

export async function submitWorkflow(
    workflow: Workflow,
    executorAddress: `0x${string}`,
    storage: IWorkflowStorage,
    owner: Signer,
    prodContract: boolean,
    ipfsServiceUrl: string,
    usePaymaster: boolean = false,
    switchChain?: (chainId: number) => Promise<void>,
    accessToken?: string,
): Promise<{
    ipfsHash: string;
    userOpHashes: UserOperationReceipt[];
}> {
    workflow.typify();
    // Off-chain validity backstop: the on-chain timestamp policy was removed (it made the
    // account address non-deterministic), and the AVS gates execution by the validity window,
    // but fail fast here too rather than submit a workflow that can never run.
    if (workflow.isExpired()) {
        throw new Error('Workflow validUntil is in the past; refusing to submit an already-expired workflow');
    }
    const { data: serializedData, initConfigs } = await serialize(workflow, executorAddress, owner, prodContract, ipfsServiceUrl, switchChain, accessToken);
    const ipfsHash = await storage.upload(serializedData);

    // Extract session account address so createWorkflow deploys from the same account
    function getSessionAccountAddress(serializedJob: any): `0x${string}` | undefined {
        try {
            const sess = serializedJob.session;
            if (!sess) return undefined;
            const base64 = sess.replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
            const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
            return decoded.accountParams?.accountAddress as `0x${string}`;
        } catch { return undefined; }
    }

    const userOpHashes: UserOperationReceipt[] = [];
    for (let i = 0; i < workflow.jobs.length; i++) {
        const job = workflow.jobs[i];
        if (switchChain) {
            await switchChain(job.chainId);
        }
        // Registry address is chain-specific on stage (different deploys per chain).
        const workflowContract = new WorkflowContract(getDittoWFRegistryAddress(prodContract, job.chainId));
        const sessionAccountAddress = getSessionAccountAddress((serializedData as any).workflow?.jobs?.[i] || (serializedData as any).jobs?.[i]);
        const receipt = await workflowContract.createWorkflow(
            ipfsHash, owner, job.chainId, ipfsServiceUrl, usePaymaster, accessToken,
            initConfigs[i],
            sessionAccountAddress,
        );
        userOpHashes.push(receipt);
    }

    return {
        ipfsHash,
        userOpHashes
    };
} 
