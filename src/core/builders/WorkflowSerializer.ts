import { Address } from 'viem';
import { Signer } from "@zerodev/sdk/types";
import { addressToEmptyAccount } from "@zerodev/sdk";
import { SerializedWorkflowData } from '../../storage/IWorkflowStorage';
import { Workflow } from '../Workflow';
import { createSession } from './SessionService';
import { SerializedWorkflowDataSchema } from '../validation/WorkflowSchema';
import { WorkflowError, WorkflowErrorCode } from '../WorkflowError';
import { OnchainConditionOperator, type Step as IStep, type Job as IJob } from '../types';

function conditionEnumToString(cond: OnchainConditionOperator): string {
    switch (cond) {
        case OnchainConditionOperator.EQUAL: return 'EQUAL';
        case OnchainConditionOperator.GREATER_THAN: return 'GREATER_THAN';
        case OnchainConditionOperator.LESS_THAN: return 'LESS_THAN';
        case OnchainConditionOperator.GREATER_THAN_OR_EQUAL: return 'GREATER_THAN_OR_EQUAL';
        case OnchainConditionOperator.LESS_THAN_OR_EQUAL: return 'LESS_THAN_OR_EQUAL';
        case OnchainConditionOperator.NOT_EQUAL: return 'NOT_EQUAL';
        case OnchainConditionOperator.ONE_OF: return 'ONE_OF';
        default: return String(cond);
    }
}

function conditionStringToEnum(text: string): OnchainConditionOperator {
    const upper = (text || '').toUpperCase();
    switch (upper) {
        case 'EQUAL': return OnchainConditionOperator.EQUAL;
        case 'GREATER_THAN': return OnchainConditionOperator.GREATER_THAN;
        case 'LESS_THAN': return OnchainConditionOperator.LESS_THAN;
        case 'GREATER_THAN_OR_EQUAL': return OnchainConditionOperator.GREATER_THAN_OR_EQUAL;
        case 'LESS_THAN_OR_EQUAL': return OnchainConditionOperator.LESS_THAN_OR_EQUAL;
        case 'NOT_EQUAL': return OnchainConditionOperator.NOT_EQUAL;
        case 'ONE_OF': return OnchainConditionOperator.ONE_OF;
        default: return OnchainConditionOperator.EQUAL;
    }
}

export interface SerializeResult {
    data: SerializedWorkflowData;
    // One initConfig per job, aligned by index with `data.workflow.jobs`. Keyed by index
    // (not chainId) so multiple jobs on the same chain don't collide — each job has its own
    // session account, hence its own initConfig.
    initConfigs: `0x${string}`[][];
}

export async function serialize(
    workflow: Workflow,
    executorAddress: Address,
    owner: Signer,
    prodContract: boolean,
    ipfsServiceUrl: string,
    switchChain?: (chainId: number) => Promise<void>,
    accessToken?: string,
): Promise<SerializeResult> {
    const jobs: any[] = [];
    const initConfigs: `0x${string}`[][] = [];
    for (const job of workflow.jobs) {
        if (switchChain) {
            await switchChain(job.chainId);
        }
        const { session, initConfig } = await createSession(workflow, job, executorAddress, owner, prodContract, ipfsServiceUrl, accessToken);
        initConfigs.push(initConfig);
        jobs.push({
            id: job.id,
            chainId: job.chainId,
            steps: job.steps.map(step => {
                const stepJson = step.toJSON();
                // Convert args and value to strings for serialization
                return {
                    ...stepJson,
                    args: stepJson.args.map((arg: any) => {
                        // Handle WASM references - keep them as strings
                        if (typeof arg === 'string' && (arg.startsWith('$wasm:') || arg.startsWith('$ref:'))) {
                            return arg;
                        }
                        return arg.toString();
                    }),
                    value: (stepJson.value || BigInt(0)).toString(),
                };
            }),
            session: session,
        });
    }
    const result = {
        workflow: {
            owner: workflow.owner.address,
            triggers: workflow.triggers
                .map(t => (typeof (t as any).toJSON === 'function' ? (t as any).toJSON() : t))
                .map((t: any) => {
                    if (t?.type === 'onchain' && t.params?.onchainCondition?.condition !== undefined) {
                        const cond = t.params.onchainCondition.condition;
                        const condStr = typeof cond === 'number' ? conditionEnumToString(cond) : String(cond);
                        return {
                            ...t,
                            params: {
                                ...t.params,
                                onchainCondition: {
                                    ...t.params.onchainCondition,
                                    condition: condStr,
                                },
                            },
                        };
                    }
                    return t;
                }),
            jobs: jobs,
            count: workflow.count,
            validAfter: workflow.validAfter instanceof Date ? Math.floor(workflow.validAfter.getTime() / 1000) : workflow.validAfter,
            validUntil: workflow.validUntil instanceof Date ? Math.floor(workflow.validUntil.getTime() / 1000) : workflow.validUntil,
            interval: workflow.interval,
        },
        metadata: {
            createdAt: Date.now(),
            version: "1.0.0",
        },
    } as SerializedWorkflowData;

    return { data: result, initConfigs };
}

export async function deserialize(
    serializedData: SerializedWorkflowData
): Promise<Workflow> {
    const validationResult = SerializedWorkflowDataSchema.safeParse(serializedData);
    if (!validationResult.success) {
        throw new WorkflowError(
            WorkflowErrorCode.INVALID_SERIALIZED_DATA,
            'Invalid workflow data',
            validationResult.error.errors
        );
    }

    const validatedData = validationResult.data;

    try {
        const workflow = new Workflow({
            owner: addressToEmptyAccount(validatedData.workflow.owner as `0x${string}`),
            triggers: validatedData.workflow.triggers.map((t): any => {
                if (t.type === 'onchain') {
                    const oc = (t as any).params?.onchainCondition;
                    const mappedCondition = oc && typeof oc.condition === 'string'
                        ? conditionStringToEnum(oc.condition)
                        : oc?.condition;
                    return {
                        ...t,
                        params: {
                            ...t.params,
                            args: (t as any).params?.args,
                            value: (t as any).params?.value !== undefined && (t as any).params?.value !== null
                                ? BigInt((t as any).params.value as any)
                                : (t as any).params?.value,
                            onchainCondition: oc
                                ? { ...oc, condition: mappedCondition }
                                : oc,
                        },
                    };
                }
                return t as any;
            }),
            jobs: validatedData.workflow.jobs.map((job): IJob => ({
                id: job.id,
                chainId: job.chainId,
                steps: job.steps.map((step): IStep => {
                    // Handle value: preserve WASM/DataRef references as strings
                    let stepValue: bigint | string | undefined;
                    if (step.value) {
                        const valueStr = String(step.value);
                        if (valueStr.startsWith('$wasm:') || valueStr.startsWith('$data:')) {
                            stepValue = valueStr; // Preserve reference string
                        } else {
                            stepValue = BigInt(step.value);
                        }
                    }
                    const baseStep: any = {
                        target: step.target,
                        abi: step.abi,
                        args: step.args,
                        value: stepValue,
                    };
                    // Include WASM fields if present
                    if ((step as any).type) baseStep.type = (step as any).type;
                    if ((step as any).wasmHash) baseStep.wasmHash = (step as any).wasmHash;
                    if ((step as any).wasmInput !== undefined) baseStep.wasmInput = (step as any).wasmInput;
                    if ((step as any).wasmId) baseStep.wasmId = (step as any).wasmId;
                    if ((step as any).wasmTimeoutMs) baseStep.wasmTimeoutMs = (step as any).wasmTimeoutMs;
                    return baseStep;
                }),
                session: job.session,
            })),
            count: validatedData.workflow.count,
            validAfter: validatedData.workflow.validAfter ? new Date(validatedData.workflow.validAfter * 1000) : undefined,
            validUntil: validatedData.workflow.validUntil ? new Date(validatedData.workflow.validUntil * 1000) : undefined,
            interval: validatedData.workflow.interval,
        });
        workflow.typify();
        return workflow;
    } catch (error) {
        if (error instanceof Error && error.message.includes('Cannot convert')) {
            throw new WorkflowError(
                WorkflowErrorCode.INVALID_BIGINT,
                'Invalid BigInt value in workflow data',
                error.message
            );
        }
        throw error;
    }
} 
