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
    usePaymaster: boolean = false
): Promise<{
    ipfsHash: string;
    userOpHashes: UserOperationReceipt[];
}> {
    const serializedData = await serialize(workflow, executorAddress, owner);
    const validation = await WorkflowValidator.validate(workflow, owner);
    if (validation.status !== ValidatorStatus.Success) {
        throw new Error(validatorStatusMessage(validation.status));
    }
    const ipfsHash = await storage.upload(serializedData);

    const workflowContract = new WorkflowContract(getDittoWFRegistryAddress());
    const userOpHashes = await Promise.all(
        workflow.jobs.map(job => workflowContract.createWorkflow(ipfsHash, owner, job.chainId, usePaymaster))
    );

    return {
        ipfsHash,
        userOpHashes
    };
} 