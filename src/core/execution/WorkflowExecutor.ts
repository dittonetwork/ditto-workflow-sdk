import { Hex, createPublicClient, http, encodeFunctionData } from 'viem';
import {
} from "@zerodev/sdk";
import { createBundlerClient, createPaymasterClient, UserOperationReceipt, UserOperation } from 'viem/account-abstraction';
import { Signer } from "@zerodev/sdk/types";
import { deserializePermissionAccount } from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { getChainConfig, getDittoWFRegistryAddress } from '../../utils/chainConfigProvider';
import { DittoWFRegistryAbi, entryPointVersion } from '../../utils/constants';
import { authHttpConfig } from '../../utils/httpTransport';
import { GasEstimate } from '../types';
import { Job } from '../Job';
import { Workflow } from '../Workflow';
import { IWorkflowStorage } from '../../storage/IWorkflowStorage';
import { deserialize } from '../builders/WorkflowSerializer';
import { Logger, getDefaultLogger } from '../Logger';

export async function execute(
    workflow: Workflow,
    executorAccount: Signer,
    ipfsHash: string,
    prodContract: boolean,
    ipfsServiceUrl: string,
    simulate: boolean = false,
    usePaymaster: boolean = false,
    logger: Logger = getDefaultLogger(),
    accessToken?: string,
): Promise<{
    success: boolean;
    results: Array<{ success: boolean; result?: UserOperationReceipt; userOp?: UserOperation, chainId?: number; gas?: GasEstimate; error?: string; start: string; finish: string }>;
}> {
    workflow.typify();
    const results = await Promise.all(
        workflow.jobs.map(async (job, i) => {
            if (!job.session) {
                throw new Error(`Job ${job.id} has no session`);
            }
            const start = new Date().toISOString();
            try {
                const result = await executeJob(
                    job,
                    executorAccount,
                    ipfsHash,
                    prodContract,
                    ipfsServiceUrl,
                    simulate,
                    usePaymaster,
                    accessToken,
                );

                if (result.error) {
                    logger.error(`❌ Session ${i + 1} failed:`, result.error);
                    const finish = new Date().toISOString();
                    return {
                        success: false,
                        error: result.error,
                        userOp: result.userOp,
                        chainId: job.chainId,
                        start,
                        finish,
                    };
                }

                logger.info(`✅ Session ${i + 1} executed:`, result);
                const finish = new Date().toISOString();
                return {
                    success: true,
                    result: result.result,
                    userOp: result.userOp,
                    signature: result.signature,
                    chainId: job.chainId,
                    gas: result.gas,
                    start,
                    finish,
                };
            } catch (error) {
                logger.error(`❌ Session ${i + 1} failed:`, error);
                const finish = new Date().toISOString();
                return {
                    chainId: job.chainId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    start,
                    finish,
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
    prodContract: boolean,
    ipfsServiceUrl: string,
    simulate: boolean = false,
    usePaymaster: boolean = false,
    accessToken?: string,
): Promise<{
    result?: UserOperationReceipt,
    gas?: GasEstimate,
    userOp?: UserOperation,
    signature?: Hex,
    error?: string,
}> {
    const chainConfig = getChainConfig(ipfsServiceUrl);
    const chain = chainConfig[job.chainId]?.chain;
    const rpcUrl = chainConfig[job.chainId]?.rpcUrl;
    if (!chain) {
        throw new Error(`Unsupported chain ID: ${job.chainId}`);
    }
    const publicClient = createPublicClient({
        transport: http(rpcUrl, authHttpConfig(accessToken)),
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
    const kernelPaymaster = createPaymasterClient({
        transport: http(rpcUrl, authHttpConfig(accessToken)),
    });
    const kernelClient = createBundlerClient({
        account: sessionKeyAccount,
        chain: chain,
        transport: http(rpcUrl, authHttpConfig(accessToken)),
        paymaster: usePaymaster ? kernelPaymaster : undefined,
        client: publicClient,
    });

    const calls = job.steps.map(step => ({
        to: step.target as `0x${string}`,
        value: step.value ?? BigInt(0),
        data: step.getCalldata() as `0x${string}`,
    }));
    calls.push({
        to: getDittoWFRegistryAddress(prodContract),
        value: BigInt(0),
        data: encodeFunctionData({
            abi: DittoWFRegistryAbi,
            functionName: "markRun",
            args: [ipfsHash],
        }),
    });


    const code = await publicClient.getCode({ address: "0xA00F87E6CBb55605DaA9435792D6551C39C5E0F2" })
    const userOperation = await kernelClient.prepareUserOperation({
        account: sessionKeyAccount,
        calls: calls,
        stateOverride: [
            {
                address: '0x5c3bf62206e62796fc14fa0433e49b1474a12f08',
                code: code,
            }]
    });

    //const signature = await sessionKeyAccount.signUserOperation(userOperation);
    const signature = "0xdead";

    try {
        if (simulate) {
            const estimation = await kernelClient.estimateUserOperationGas({
                account: sessionKeyAccount,
                calls: calls,
                stateOverride: [
                    {
                        address: '0x5c3bf62206e62796fc14fa0433e49b1474a12f08',
                        code: code,
                    }]
            });
            const fees = await publicClient.estimateFeesPerGas();
            const feePerGas = BigInt(fees.maxFeePerGas);
            const totalGasUnits =
                estimation.preVerificationGas +
                estimation.verificationGasLimit +
                estimation.callGasLimit +
                (estimation.paymasterVerificationGasLimit ?? BigInt(0)) +
                (estimation.paymasterPostOpGasLimit ?? BigInt(0));
            const totalGasEstimate = totalGasUnits * feePerGas;
            return {
                gas: {
                    preVerificationGas: estimation.preVerificationGas,
                    verificationGasLimit: estimation.verificationGasLimit,
                    callGasLimit: estimation.callGasLimit,
                    paymasterVerificationGasLimit: estimation.paymasterVerificationGasLimit,
                    paymasterPostOpGasLimit: estimation.paymasterPostOpGasLimit,
                    totalGasEstimate,
                },
                userOp: userOperation,
                signature: signature,
            };
        }
        const userOpHash = await kernelClient.sendUserOperation({
            callData: await sessionKeyAccount.encodeCalls(calls),
        });
        const result = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
        return {
            result: result,
            userOp: userOperation,
            signature: signature,
        };
    } catch (error) {
        return {
            userOp: userOperation,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

export async function executeFromIpfs(
    ipfsHash: string,
    storage: IWorkflowStorage,
    executorAccount: Signer,
    prodContract: boolean,
    ipfsServiceUrl: string,
    simulate: boolean = false,
    usePaymaster: boolean = false,
    accessToken?: string,
): Promise<{
    success: boolean;
    results: Array<{ success: boolean; result?: UserOperationReceipt; userOp?: UserOperation; chainId?: number; gas?: GasEstimate; error?: string; start: string; finish: string }>;
    markRunHash?: Hex;
}> {
    const data = await storage.download(ipfsHash);
    const workflow = await deserialize(data);
    // const validation = await WorkflowValidator.validate(workflow, executorAccount, ipfsServiceUrl, { checkSessions: true });
    // if (validation.status !== ValidatorStatus.Success) {
    //     throw new Error(validatorStatusMessage(validation.status));
    // }
    const results = await execute(workflow, executorAccount, ipfsHash, prodContract, ipfsServiceUrl, simulate, usePaymaster, undefined, accessToken);

    return {
        success: results.success,
        results: results.results,
    };
} 
