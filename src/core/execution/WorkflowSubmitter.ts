import { Workflow } from '../Workflow';
import { IWorkflowStorage } from '../../storage/IWorkflowStorage';
import { WorkflowContract } from '../../contracts/WorkflowContract';
import { serialize } from '../builders/WorkflowSerializer';
import { Signer } from "@zerodev/sdk/types";
import { UserOperationReceipt } from 'viem/account-abstraction';
import { ValidatorStatus, validatorStatusMessage, WorkflowValidator } from '../validation/WorkflowValidator';
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
    const serializedData = await serialize(workflow, executorAddress, owner, prodContract, ipfsServiceUrl, switchChain, accessToken);
    // const validation = await WorkflowValidator.validate(workflow, owner, ipfsServiceUrl);
    // if (validation.status !== ValidatorStatus.Success) {
    //     throw new Error(validatorStatusMessage(validation.status));
    // }
    const ipfsHash = await storage.upload(serializedData);

    const workflowContract = new WorkflowContract(getDittoWFRegistryAddress(prodContract));
    const userOpHashes: UserOperationReceipt[] = [];
    for (const job of workflow.jobs) {
        if (switchChain) {
            await switchChain(job.chainId);
        }
        const receipt = await workflowContract.createWorkflow(ipfsHash, owner, job.chainId, ipfsServiceUrl, usePaymaster, accessToken);
        userOpHashes.push(receipt);
    }

    return {
        ipfsHash,
        userOpHashes
    };
} 
