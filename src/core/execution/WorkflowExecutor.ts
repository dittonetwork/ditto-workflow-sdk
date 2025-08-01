import { Hex, createPublicClient, http, encodeFunctionData } from 'viem';
import {
    createZeroDevPaymasterClient,
    createKernelAccountClient,
    gasTokenAddresses,
} from "@zerodev/sdk";
import { Signer } from "@zerodev/sdk/types";
import { deserializePermissionAccount } from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { getChainConfig, getDittoWFRegistryAddress } from '../../utils/chainConfigProvider';
import { DittoWFRegistryAbi, entryPointVersion } from '../../utils/constants';
import { GasEstimate } from '../types';
import { Job } from '../Job';
import { Workflow } from '../Workflow';
import { IWorkflowStorage } from '../../storage/IWorkflowStorage';
import { deserialize } from '../builders/WorkflowSerializer';
import { Logger, getDefaultLogger } from '../Logger';
import { UserOperationReceipt, UserOperation } from 'viem/account-abstraction';
import { ValidatorStatus, validatorStatusMessage, WorkflowValidator } from '../validation/WorkflowValidator';

export async function execute(
    workflow: Workflow,
    executorAccount: Signer,
    ipfsHash: string,
    nonce: bigint,
    simulate: boolean = false,
    usePaymaster: boolean = false,
    logger: Logger = getDefaultLogger()
): Promise<{
    success: boolean;
    results: Array<{ success: boolean; result?: UserOperationReceipt; userOp?: UserOperation, chainId?: number; gas?: GasEstimate; error?: string }>;
}> {
    const results = await Promise.all(
        workflow.jobs.map(async (job, i) => {
            if (!job.session) {
                throw new Error(`Job ${job.id} has no session`);
            }
            try {
                const result = await executeJob(
                    job,
                    executorAccount,
                    ipfsHash,
                    nonce,
                    simulate,
                    usePaymaster
                );

                logger.info(`✅ Session ${i + 1} executed:`, result);
                return {
                    success: true,
                    result: result.result,
                    userOp: result.userOp,
                    chainId: job.chainId,
                    gas: result.gas,
                };
            } catch (error) {
                logger.error(`❌ Session ${i + 1} failed:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        })
    );

    return {
        success: results.every((r: any) => r.success),
        results
    };
}

export async function executeJob(
    job: Job,
    executorAccount: Signer,
    ipfsHash: string,
    nonce: bigint,
    simulate: boolean = false,
    usePaymaster: boolean = false
): Promise<{
    result?: UserOperationReceipt,
    gas?: GasEstimate,
    userOp?: UserOperation
}> {
    const chainConfig = getChainConfig();
    const chain = chainConfig[job.chainId]?.chain;
    const rpcUrl = chainConfig[job.chainId]?.rpcUrl;
    if (!chain) {
        throw new Error(`Unsupported chain ID: ${job.chainId}`);
    }
    const publicClient = createPublicClient({
        transport: http(rpcUrl),
        chain: chain,
    });

    const entryPoint = getEntryPoint(entryPointVersion);
    const sessionKeyAccount = await deserializePermissionAccount(
        publicClient,
        entryPoint,
        KERNEL_V3_3,
        job.session as string,
        await toECDSASigner({ signer: executorAccount })
    );
    const kernelPaymaster = createZeroDevPaymasterClient({
        chain: chain,
        transport: http(rpcUrl),
    });

    const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain: chain,
        bundlerTransport: http(rpcUrl),
        paymaster: usePaymaster ? {
            getPaymasterData(userOperation) {
                return kernelPaymaster.sponsorUserOperation({ userOperation });
            }
        } : undefined,
    });

    const calls = job.steps.map(step => ({
        to: step.target as `0x${string}`,
        value: step.value ?? BigInt(0),
        data: step.getCalldata() as `0x${string}`,
    }));
    calls.push({
        to: getDittoWFRegistryAddress(),
        value: BigInt(0),
        data: encodeFunctionData({
            abi: DittoWFRegistryAbi,
            functionName: "markRun",
            args: [ipfsHash],
        }),
    });

    const userOperation = await kernelClient.prepareUserOperation({
        account: sessionKeyAccount,
        calls: calls,
    });

    if (simulate) {
        const estimation = await kernelPaymaster.estimateGasInERC20(
            {
                userOperation: userOperation,
                gasTokenAddress: (gasTokenAddresses as Record<number, any>)[job.chainId]["USDC"],
                entryPoint: entryPoint.address as `0x${string}`,
            }
        );
        return {
            gas: {
                amount: estimation.amount,
            },
            userOp: userOperation,
        };
    }
    const userOpHash = await kernelClient.sendUserOperation({
        calls: calls,
    });
    const result = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
    return {
        result: result,
        userOp: userOperation,
    };
}

export async function executeFromIpfs(
    ipfsHash: string,
    storage: IWorkflowStorage,
    executorAccount: Signer,
    nonce: bigint,
    simulate: boolean = false,
    usePaymaster: boolean = false
): Promise<{
    success: boolean;
    results: Array<{ success: boolean; result?: UserOperationReceipt; userOp?: UserOperation; chainId?: number; gas?: GasEstimate; error?: string }>;
    markRunHash?: Hex;
}> {
    const data = await storage.download(ipfsHash);
    const workflow = await deserialize(data);
    const validation = await WorkflowValidator.validate(workflow, executorAccount, { checkSessions: true });
    if (validation.status !== ValidatorStatus.Success) {
        throw new Error(validatorStatusMessage(validation.status));
    }
    const results = await execute(workflow, executorAccount, ipfsHash, nonce, simulate, usePaymaster);

    return {
        success: results.success,
        results: results.results,
    };
} 