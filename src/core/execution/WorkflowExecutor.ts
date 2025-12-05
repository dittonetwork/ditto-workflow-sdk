import { Hex, createPublicClient, http, encodeFunctionData, parseAbiItem, AbiFunction, Address } from 'viem';
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
import { Step } from '../Step';
import { Workflow } from '../Workflow';
import { IWorkflowStorage } from '../../storage/IWorkflowStorage';
import { deserialize } from '../builders/WorkflowSerializer';
import { Logger, getDefaultLogger } from '../Logger';
import { DataRefResolver, DataRefContext } from '../DataRefResolver';

/**
 * Execute a workflow with optional DataRef context for deterministic consensus.
 * 
 * In Othentic flow:
 * - Leader calls this WITHOUT dataRefContext → creates new context with block numbers
 * - Leader passes dataRefContext to operators via proofOfTask
 * - Operators call this WITH dataRefContext → uses same block numbers for deterministic replay
 * 
 * @param workflow - The workflow to execute
 * @param executorAccount - Account to sign operations
 * @param ipfsHash - Workflow IPFS hash
 * @param prodContract - Use production contract address
 * @param ipfsServiceUrl - IPFS service URL for chain config
 * @param simulate - If true, only simulate (don't send)
 * @param usePaymaster - Use paymaster for gas
 * @param logger - Logger instance
 * @param accessToken - Optional auth token
 * @param dataRefContext - Optional context for deterministic replay (operator mode)
 */
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
    dataRefContext?: DataRefContext,
): Promise<{
    success: boolean;
    results: Array<{ 
        success: boolean; 
        result?: UserOperationReceipt; 
        userOp?: UserOperation; 
        chainId?: number; 
        gas?: GasEstimate; 
        error?: string; 
        start: string; 
        finish: string;
        /** DataRef context for this job - pass to operators */
        dataRefContext?: DataRefContext;
    }>;
    /** Combined DataRef context from all jobs - pass to operators for consensus */
    dataRefContext?: DataRefContext;
}> {
    workflow.typify();
    
    // Collect all contexts from jobs
    const allContexts: DataRefContext[] = [];
    
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
                    dataRefContext,
                );
                
                // Collect context for combining later
                if (result.dataRefContext) {
                    allContexts.push(result.dataRefContext);
                }

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
                        dataRefContext: result.dataRefContext,
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
                    dataRefContext: result.dataRefContext,
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
    
    // Combine all contexts into one
    const combinedContext: DataRefContext = {
        chainBlocks: {},
        resolvedRefs: [],
    };
    for (const ctx of allContexts) {
        Object.assign(combinedContext.chainBlocks, ctx.chainBlocks);
        combinedContext.resolvedRefs.push(...ctx.resolvedRefs);
    }

    return {
        success: results.every((r: any) => r.success),
        results,
        dataRefContext: combinedContext.resolvedRefs.length > 0 ? combinedContext : undefined,
    };
}

/**
 * Execute a single job with optional DataRef context for deterministic consensus.
 * 
 * @param job - The job to execute
 * @param executorAccount - Account to sign operations
 * @param ipfsHash - Workflow IPFS hash
 * @param prodContract - Use production contract address
 * @param ipfsServiceUrl - IPFS service URL for chain config
 * @param simulate - If true, only simulate (don't send)
 * @param usePaymaster - Use paymaster for gas
 * @param accessToken - Optional auth token
 * @param dataRefContext - Optional context for deterministic replay (operator mode)
 *                         If not provided, creates new context (leader mode)
 */
export async function executeJob(
    job: Job,
    executorAccount: Signer,
    ipfsHash: string,
    prodContract: boolean,
    ipfsServiceUrl: string,
    simulate: boolean = false,
    usePaymaster: boolean = false,
    accessToken?: string,
    dataRefContext?: DataRefContext,
): Promise<{
    result?: UserOperationReceipt,
    gas?: GasEstimate,
    userOp?: UserOperation,
    signature?: Hex,
    error?: string,
    /** DataRef context with block numbers - pass to operators for deterministic replay */
    dataRefContext?: DataRefContext,
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

    // Resolve data references in step arguments before execution
    // If dataRefContext provided, use it for deterministic replay (operator mode)
    // Otherwise create new context (leader mode)
    const dataRefResolver = new DataRefResolver(ipfsServiceUrl, accessToken, dataRefContext);
    const resolvedSteps: Step[] = [];
    
    for (const step of job.steps) {
      if (DataRefResolver.hasDataRefs(step.args)) {
        const resolvedArgs = await dataRefResolver.resolveArgs(step.args);
        resolvedSteps.push(new Step({
          target: step.target as Address,
          abi: step.abi,
          args: resolvedArgs,
          value: step.value,
        }));
      } else {
        resolvedSteps.push(step);
      }
    }
    
    // Get the context (with block numbers) for passing to operators
    const resolvedContext = dataRefResolver.getContext();

    const calls = resolvedSteps.map(step => ({
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

    let signature: Hex;
    try {
        signature = await sessionKeyAccount.signUserOperation(userOperation);
    } catch (error) {
        console.log(error);
        signature = userOperation.signature;
    }

    try {
        if (simulate) {
            const estimation = await kernelClient.estimateUserOperationGas({
                account: sessionKeyAccount,
                calls: calls,
                stateOverride: [
                    {
                        address: '0x054F818907C7461Fa347431D55EDc22f93C77dAd',
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
                dataRefContext: resolvedContext,
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
            dataRefContext: resolvedContext,
        };
    } catch (error) {
        return {
            userOp: userOperation,
            error: error instanceof Error ? error.message : 'Unknown error',
            dataRefContext: resolvedContext,
        }
    }
}

/**
 * Execute a workflow from IPFS with optional DataRef context for deterministic consensus.
 * 
 * @param ipfsHash - Workflow IPFS hash
 * @param storage - IPFS storage interface
 * @param executorAccount - Account to sign operations
 * @param prodContract - Use production contract address
 * @param ipfsServiceUrl - IPFS service URL for chain config
 * @param simulate - If true, only simulate (don't send)
 * @param usePaymaster - Use paymaster for gas
 * @param accessToken - Optional auth token
 * @param dataRefContext - Optional context for deterministic replay (operator mode)
 */
export async function executeFromIpfs(
    ipfsHash: string,
    storage: IWorkflowStorage,
    executorAccount: Signer,
    prodContract: boolean,
    ipfsServiceUrl: string,
    simulate: boolean = false,
    usePaymaster: boolean = false,
    accessToken?: string,
    dataRefContext?: DataRefContext,
): Promise<{
    success: boolean;
    results: Array<{ 
        success: boolean; 
        result?: UserOperationReceipt; 
        userOp?: UserOperation; 
        chainId?: number; 
        gas?: GasEstimate; 
        error?: string; 
        start: string; 
        finish: string;
        dataRefContext?: DataRefContext;
    }>;
    markRunHash?: Hex;
    /** DataRef context - pass to operators for deterministic consensus */
    dataRefContext?: DataRefContext;
}> {
    const data = await storage.download(ipfsHash);
    const workflow = await deserialize(data);
    // const validation = await WorkflowValidator.validate(workflow, executorAccount, ipfsServiceUrl, { checkSessions: true });
    // if (validation.status !== ValidatorStatus.Success) {
    //     throw new Error(validatorStatusMessage(validation.status));
    // }
    const results = await execute(
        workflow, 
        executorAccount, 
        ipfsHash, 
        prodContract, 
        ipfsServiceUrl, 
        simulate, 
        usePaymaster, 
        undefined, 
        accessToken,
        dataRefContext
    );

    return {
        success: results.success,
        results: results.results,
        dataRefContext: results.dataRefContext,
    };
} 
