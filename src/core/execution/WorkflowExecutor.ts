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
import { WasmRefResolver, WasmRefContext, WasmRef } from '../WasmRefResolver';

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
    wasmClient?: any, // WasmClient instance from simulator
    database?: any, // Database instance for WASM module lookup
    wasmRefContext?: WasmRefContext, // For deterministic replay (operator mode)
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
        /** WASM ref context for this job - pass to operators */
        wasmRefContext?: WasmRefContext;
    }>;
    /** Combined DataRef context from all jobs - pass to operators for consensus */
    dataRefContext?: DataRefContext;
    /** Combined WASM ref context from all jobs - pass to operators for consensus */
    wasmRefContext?: WasmRefContext;
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
                    wasmClient,
                    database,
                    wasmRefContext,
                    logger,
                );
                
                // Collect contexts for combining later
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
                        wasmRefContext: result.wasmRefContext,
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
                    wasmRefContext: result.wasmRefContext,
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
    
    // Combine all DataRef contexts into one
    const combinedDataRefContext: DataRefContext = {
        chainBlocks: {},
        resolvedRefs: [],
    };
    for (const ctx of allContexts) {
        Object.assign(combinedDataRefContext.chainBlocks, ctx.chainBlocks);
        combinedDataRefContext.resolvedRefs.push(...ctx.resolvedRefs);
    }

    // Combine all WASM ref contexts into one
    const allWasmContexts: WasmRefContext[] = [];
    for (const r of results) {
        if (r.wasmRefContext) {
            allWasmContexts.push(r.wasmRefContext);
        }
    }
    const combinedWasmRefContext: WasmRefContext = {
        resolvedRefs: [],
    };
    for (const ctx of allWasmContexts) {
        combinedWasmRefContext.resolvedRefs.push(...ctx.resolvedRefs);
    }

    return {
        success: results.every((r: any) => r.success),
        results,
        dataRefContext: combinedDataRefContext.resolvedRefs.length > 0 ? combinedDataRefContext : undefined,
        wasmRefContext: combinedWasmRefContext.resolvedRefs.length > 0 ? combinedWasmRefContext : undefined,
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
    wasmClient?: any, // WasmClient instance from simulator
    database?: any, // Database instance for WASM module lookup
    wasmRefContext?: WasmRefContext, // For deterministic replay (operator mode)
    logger: Logger = getDefaultLogger(), // Logger instance
): Promise<{
    result?: UserOperationReceipt,
    gas?: GasEstimate,
    userOp?: UserOperation,
    signature?: Hex,
    error?: string,
    /** DataRef context with block numbers - pass to operators for deterministic replay */
    dataRefContext?: DataRefContext,
    /** WASM ref context - pass to operators for deterministic replay */
    wasmRefContext?: WasmRefContext,
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

    // Step 1: Execute WASM steps first (they can make RPC calls)
    // WASM results can then be referenced in subsequent contract steps
    const wasmRefResolver = (wasmClient && database)
      ? new WasmRefResolver(wasmClient, database, wasmRefContext, logger)
      : null;
    
    const contractSteps: Step[] = [];
    const wasmSteps: Step[] = [];
    
      // Separate WASM steps from contract steps
    for (const step of job.steps) {
      // Check if step is a WASM step (either via type field or isWasmStep method)
      const isWasm = (step as any).type === 'wasm' || 
                     ((step as any).isWasmStep && (step as any).isWasmStep()) ||
                     ((step as any).wasmHash && (step as any).wasmId);
      
      if (isWasm) {
        wasmSteps.push(step);
      } else {
        contractSteps.push(step);
      }
    }
    
    // Execute WASM steps and store results
    if (wasmSteps.length > 0) {
      if (!wasmRefResolver) {
        // Owner not whitelisted or WASM client/database not available
        // Skip WASM steps and log warning
        logger.info(`Skipping ${wasmSteps.length} WASM step(s) - owner not whitelisted or WASM client/database not available`);
        // WASM steps are skipped, but contract steps can still execute
        // Note: Contract steps referencing WASM results will fail during resolution
      } else {
        for (const wasmStep of wasmSteps) {
          const wasmStepAny = wasmStep as any;
          const wasmId = wasmStepAny.wasmId;
          if (!wasmId) {
            logger.error(`WASM step missing wasmId - cannot execute or reference this step`);
            throw new Error(`WASM step is missing required wasmId field`);
          }
          
          const wasmRef: WasmRef = {
            wasmHash: wasmStepAny.wasmHash!,
            input: wasmStepAny.wasmInput || {},
            id: wasmId,
            timeoutMs: wasmStepAny.wasmTimeoutMs,
          };
          
          logger.info(`Preparing to execute WASM step with wasmId: ${wasmId}, hash: ${wasmRef.wasmHash}`);
          
          // If we have existing context (operator mode), skip execution
          // Otherwise execute and store result
          if (!wasmRefContext) {
            try {
              await wasmRefResolver.executeWasmStep(wasmRef);
              logger.info(`WASM step ${wasmId} executed successfully and result stored`);
            } catch (error) {
              logger.error(`WASM step ${wasmId} execution failed:`, error);
              throw error; // Re-throw to stop execution
            }
          } else {
            logger.info(`Using existing WASM context for step ${wasmId} (operator mode)`);
            // Verify the context has this WASM result
            const existingResult = wasmRefContext.resolvedRefs.find(r => r.ref.id === wasmId);
            if (!existingResult) {
              throw new Error(`WASM reference ${wasmId} not found in provided context (operator mode)`);
            }
          }
        }
      }
    }
    
    // Step 2: Resolve data references in contract step arguments
    // This can now include WASM references (if wasmRefResolver is available)
    // If dataRefContext provided, use it for deterministic replay (operator mode)
    // Otherwise create new context (leader mode)
    const dataRefResolver = new DataRefResolver(ipfsServiceUrl, accessToken, dataRefContext);
    const resolvedSteps: Step[] = [];
    
    for (const step of contractSteps) {
      // First resolve WASM references if any
      let argsToResolve = step.args;
      if (WasmRefResolver.hasWasmRefs(step.args)) {
        if (!wasmRefResolver) {
          throw new Error(
            `Contract step references WASM result but owner is not whitelisted for WASM execution. ` +
            `WASM steps were skipped. Please whitelist the workflow owner or remove WASM references from contract steps.`
          );
        }
        argsToResolve = await wasmRefResolver.resolveArgs(step.args);
      }
      
      // Then resolve DataRef references
      if (DataRefResolver.hasDataRefs(argsToResolve)) {
        const resolvedArgs = await dataRefResolver.resolveArgs(argsToResolve);
        const stepParams: any = {
          target: step.target as Address,
          abi: step.abi,
          args: resolvedArgs,
          value: step.value,
        };
        // Preserve WASM fields if present (shouldn't be for contract steps, but just in case)
        if ((step as any).type) stepParams.type = (step as any).type;
        if ((step as any).wasmHash) stepParams.wasmHash = (step as any).wasmHash;
        if ((step as any).wasmInput !== undefined) stepParams.wasmInput = (step as any).wasmInput;
        if ((step as any).wasmId) stepParams.wasmId = (step as any).wasmId;
        if ((step as any).wasmTimeoutMs) stepParams.wasmTimeoutMs = (step as any).wasmTimeoutMs;
        resolvedSteps.push(new Step(stepParams));
      } else {
        const stepParams: any = {
          target: step.target as Address,
          abi: step.abi,
          args: argsToResolve,
          value: step.value,
        };
        // Preserve WASM fields if present (shouldn't be for contract steps, but just in case)
        if ((step as any).type) stepParams.type = (step as any).type;
        if ((step as any).wasmHash) stepParams.wasmHash = (step as any).wasmHash;
        if ((step as any).wasmInput !== undefined) stepParams.wasmInput = (step as any).wasmInput;
        if ((step as any).wasmId) stepParams.wasmId = (step as any).wasmId;
        if ((step as any).wasmTimeoutMs) stepParams.wasmTimeoutMs = (step as any).wasmTimeoutMs;
        resolvedSteps.push(new Step(stepParams));
      }
    }
    
    // Get the contexts for passing to operators
    const resolvedDataRefContext = dataRefResolver.getContext();
    const resolvedWasmRefContext = wasmRefResolver?.getContext();

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
                dataRefContext: resolvedDataRefContext,
                wasmRefContext: resolvedWasmRefContext,
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
            dataRefContext: resolvedDataRefContext,
            wasmRefContext: resolvedWasmRefContext,
        };
    } catch (error) {
        return {
            userOp: userOperation,
            error: error instanceof Error ? error.message : 'Unknown error',
            dataRefContext: resolvedDataRefContext,
            wasmRefContext: resolvedWasmRefContext,
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
    wasmClient?: any, // WasmClient instance from simulator
    database?: any, // Database instance for WASM module lookup
    wasmRefContext?: WasmRefContext, // For deterministic replay (operator mode)
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
        wasmRefContext?: WasmRefContext;
    }>;
    markRunHash?: Hex;
    /** DataRef context - pass to operators for deterministic consensus */
    dataRefContext?: DataRefContext;
    /** WASM ref context - pass to operators for deterministic consensus */
    wasmRefContext?: WasmRefContext;
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
        dataRefContext,
        wasmClient,
        database,
        wasmRefContext
    );

    return {
        success: results.success,
        results: results.results,
        dataRefContext: results.dataRefContext,
        wasmRefContext: results.wasmRefContext,
    };
} 
