import { Address } from 'viem';
import { Signer } from "@zerodev/sdk/types";
import { addressToEmptyAccount } from "@zerodev/sdk";
import { SerializedWorkflowData } from '../../storage/IWorkflowStorage';
import { Workflow } from '../Workflow';
import { createSession } from './SessionService';
import { SerializedWorkflowDataSchema } from '../validation/WorkflowSchema';
import { WorkflowError, WorkflowErrorCode } from '../WorkflowError';
import type { Step as IStep, Job as IJob } from '../types';

function extractInputTypesFromAbiSignature(signature: string): string[] {
    const match = signature.match(/^\s*[^\s(]+\s*\(([^)]*)\)/);
    if (!match) {
        return [];
    }
    const params = match[1].trim();
    if (params.length === 0) {
        return [];
    }
    return params
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => {
            const firstSpace = p.indexOf(' ');
            return (firstSpace === -1 ? p : p.slice(0, firstSpace)).trim();
        });
}

function coerceArgToType(raw: any, type: string): any {
    if (raw === null || raw === undefined) return raw;
    const lower = type.toLowerCase();
    if (lower === 'bool') {
        if (typeof raw === 'boolean') return raw;
        if (typeof raw === 'string') return raw.toLowerCase() === 'true';
        return Boolean(raw);
    }
    if (lower.startsWith('uint') || lower.startsWith('int')) {
        if (typeof raw === 'bigint') return raw;
        if (typeof raw === 'number') return BigInt(raw);
        if (typeof raw === 'string') return BigInt(raw);
        return BigInt(raw as any);
    }
    if (lower === 'address') {
        return String(raw) as any;
    }
    if (lower === 'string') {
        return String(raw);
    }
    if (lower.startsWith('bytes')) {
        return String(raw);
    }
    return raw;
}

function coerceArgsByAbi(signature: string, rawArgs: any[]): any[] {
    try {
        const types = extractInputTypesFromAbiSignature(signature);
        if (types.length === 0) return rawArgs;
        return rawArgs.map((arg, idx) => coerceArgToType(arg, types[Math.min(idx, types.length - 1)]));
    } catch {
        return rawArgs;
    }
}

export async function serialize(
    workflow: Workflow,
    executorAddress: Address,
    owner: Signer,
    prodContract: boolean,
    zerodevApiKey: string
): Promise<SerializedWorkflowData> {
    return {
        workflow: {
            owner: workflow.owner.address,
            triggers: workflow.triggers.map((t: any) => {
                if (t.type === 'onchain') {
                    return {
                        type: 'onchain',
                        params: {
                            target: t.params.target,
                            abi: t.params.abi,
                            args: Array.isArray(t.params.args) ? t.params.args.map((a: any) => a != null ? a.toString() : '') : [],
                            value: (t.params.value ?? BigInt(0)).toString(),
                            chainId: t.params.chainId,
                            onchainCondition: t.params.onchainCondition
                                ? {
                                    condition: String(t.params.onchainCondition.condition),
                                    value: t.params.onchainCondition.value != null ? String(t.params.onchainCondition.value) : ''
                                }
                                : undefined,
                        },
                    } as any;
                }
                if (t.type === 'event') {
                    const filterObj = Object.fromEntries(
                        Object.entries(t.params.filter || {}).map(([k, v]: [string, any]) => [k, v != null ? String(v) : ''])
                    );
                    return {
                        type: 'event',
                        params: {
                            signature: t.params.signature,
                            contractAddress: t.params.contractAddress,
                            chainId: t.params.chainId,
                            filter: filterObj,
                        },
                    } as any;
                }
                // cron
                return t as any;
            }),
            jobs: await Promise.all(workflow.jobs.map(async job => ({
                id: job.id,
                chainId: job.chainId,
                steps: job.steps.map(step => ({
                    target: step.target,
                    abi: step.abi,
                    args: step.args.map(arg => arg.toString()),
                    value: (step.value || BigInt(0)).toString(),
                })),
                session: await createSession(workflow, job, executorAddress, owner, prodContract, zerodevApiKey),
            }))),
            count: workflow.count,
            validAfter: workflow.validAfter instanceof Date ? Math.floor(workflow.validAfter.getTime() / 1000) : workflow.validAfter,
            validUntil: workflow.validUntil instanceof Date ? Math.floor(workflow.validUntil.getTime() / 1000) : workflow.validUntil,
            interval: workflow.interval,
        },
        metadata: {
            createdAt: Date.now(),
            version: "1.0.0",
        },
    };
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
        return new Workflow({
            owner: addressToEmptyAccount(validatedData.workflow.owner as `0x${string}`),
            triggers: validatedData.workflow.triggers.map((t): any => {
                if (t.type === 'onchain') {
                    return {
                        ...t,
                        params: {
                            ...t.params,
                            args: Array.isArray((t as any).params?.args)
                                ? coerceArgsByAbi((t as any).params.abi, (t as any).params.args)
                                : (t as any).params?.args,
                            value: (t as any).params?.value !== undefined && (t as any).params?.value !== null
                                ? BigInt((t as any).params.value as any)
                                : (t as any).params?.value,
                        },
                    };
                }
                if (t.type === 'event') {
                    return {
                        ...t,
                        params: {
                            ...t.params,
                            filter: Object.fromEntries(
                                Object.entries((t as any).params?.filter || {}).map(([k, v]: [string, any]) => [k, v])
                            ),
                        },
                    };
                }
                return t as any; // cron
            }),
            jobs: validatedData.workflow.jobs.map((job): IJob => ({
                id: job.id,
                chainId: job.chainId,
                steps: job.steps.map((step): IStep => ({
                    target: step.target,
                    abi: step.abi,
                    args: Array.isArray(step.args) ? coerceArgsByAbi(step.abi, step.args as any[]) : step.args,
                    value: step.value ? BigInt(step.value) : undefined,
                })),
                session: job.session,
            })),
            count: validatedData.workflow.count,
            validAfter: validatedData.workflow.validAfter ? new Date(validatedData.workflow.validAfter * 1000) : undefined,
            validUntil: validatedData.workflow.validUntil ? new Date(validatedData.workflow.validUntil * 1000) : undefined,
            interval: validatedData.workflow.interval,
        });
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