import { Workflow } from '../Workflow'
import { Signer } from '@zerodev/sdk/types'
import { Address, createPublicClient, http, isAddress, parseAbiItem } from 'viem'
import { getEntryPoint, KERNEL_V3_3 } from '@zerodev/sdk/constants'
import { deserializePermissionAccount } from '@zerodev/permissions'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { getChainConfig } from '../../utils/chainConfigProvider'
import { entryPointVersion } from '../../utils/constants'
import { buildPolicies } from '../builders/PermissionBuilder'
import { OnchainConditionOperator } from '../types'
import { createSession } from '../builders/SessionService'

export enum ValidatorStatus {
    Success = 0,
    InvalidOwner = 1,
    InvalidDates = 2,
    InvalidCount = 3,
    InvalidInterval = 4,
    DuplicateChainId = 5,
    JobWithoutSession = 6,
    ExecutorMismatch = 7,
    UnsupportedChainId = 8,
    InvalidSessionPolicy = 9,
    InvalidTrigger = 10,
    InvalidStep = 11,
}

export function validatorStatusMessage(status: ValidatorStatus): string {
    switch (status) {
        case ValidatorStatus.Success: return 'success'
        case ValidatorStatus.InvalidOwner: return 'invalid owner address'
        case ValidatorStatus.InvalidDates: return 'invalid validity dates'
        case ValidatorStatus.InvalidCount: return 'invalid count value'
        case ValidatorStatus.InvalidInterval: return 'invalid interval value'
        case ValidatorStatus.DuplicateChainId: return 'duplicate chain id in jobs'
        case ValidatorStatus.JobWithoutSession: return 'job without session key'
        case ValidatorStatus.ExecutorMismatch: return 'executor does not match session key signer'
        case ValidatorStatus.UnsupportedChainId: return 'unsupported chain id'
        case ValidatorStatus.InvalidSessionPolicy: return 'session policies mismatch'
        case ValidatorStatus.InvalidTrigger: return 'invalid trigger specification'
        case ValidatorStatus.InvalidStep: return 'invalid step specification'
        default: return 'unknown error'
    }
}

function isValidArgForType(arg: any, type: string): boolean {
    if (type.startsWith('address')) return typeof arg === 'string' && isAddress(arg as Address)
    if (type.startsWith('uint') || type.startsWith('int')) return typeof arg === 'bigint' || typeof arg === 'number' || (typeof arg === 'string' && /^\d+$/.test(arg))
    if (type === 'bool') return typeof arg === 'boolean' || typeof arg === 'string' && /^(true|false)$/.test(arg)
    if (type.startsWith('bytes')) return typeof arg === 'string' && /^0x[0-9a-fA-F]*$/.test(arg)
    if (type === 'string') return typeof arg === 'string'
    return true
}

export class WorkflowValidator {
    static async validate(
        workflow: Workflow,
        executor: Signer,
        zerodevApiKey: string,
        options: { checkSessions?: boolean } = {},
    ): Promise<{ status: ValidatorStatus; errors: string[] }> {
        const { checkSessions = false } = options
        const errors: string[] = []
        const statuses: Set<ValidatorStatus> = new Set()

        if (!workflow.owner || !(workflow.owner as any).address || /^(0x0{40})$/i.test((workflow.owner as any).address)) {
            statuses.add(ValidatorStatus.InvalidOwner)
            errors.push('owner is zero address')
        }

        if (workflow.validAfter && workflow.validUntil) {
            if (workflow.validAfter >= workflow.validUntil) {
                statuses.add(ValidatorStatus.InvalidDates)
                errors.push('validAfter must be before validUntil')
            }
        }
        if (workflow.validUntil && workflow.validUntil.getTime() <= Date.now()) {
            statuses.add(ValidatorStatus.InvalidDates)
            errors.push('validUntil must be in the future')
        }

        if (workflow.count !== undefined && workflow.count <= 0) {
            statuses.add(ValidatorStatus.InvalidCount)
            errors.push('count must be positive')
        }

        if (workflow.interval !== undefined && workflow.interval <= 0) {
            statuses.add(ValidatorStatus.InvalidInterval)
            errors.push('interval must be positive')
        }

        const chainIds = new Set<number>()
        for (const job of workflow.jobs) {
            if (chainIds.has(job.chainId)) {
                statuses.add(ValidatorStatus.DuplicateChainId)
                errors.push(`duplicate chainId ${job.chainId}`)
            } else {
                chainIds.add(job.chainId)
            }
        }

        const chainConfig = getChainConfig(zerodevApiKey)

        for (const job of workflow.jobs) {
            if (checkSessions && !job.session) {
                statuses.add(ValidatorStatus.JobWithoutSession)
                errors.push(`job ${job.id} has no session`)
            }

            if (checkSessions && job.session && chainConfig[job.chainId]) {
                try {
                    const cfg = chainConfig[job.chainId]
                    const publicClient = createPublicClient({ transport: http(cfg.rpcUrl), chain: cfg.chain })
                    await deserializePermissionAccount(
                        publicClient,
                        getEntryPoint(entryPointVersion),
                        KERNEL_V3_3,
                        job.session,
                        await toECDSASigner({ signer: executor })
                    )
                } catch (_) {
                    statuses.add(ValidatorStatus.InvalidSessionPolicy)
                    errors.push(`cannot deserialize session for job ${job.id}`)
                }
            }
            if (!chainConfig[job.chainId]) {
                statuses.add(ValidatorStatus.UnsupportedChainId)
                errors.push(`unsupported chain ${job.chainId}`)
            }
            for (const step of job.steps) {
                if (!isAddress(step.target as any)) {
                    statuses.add(ValidatorStatus.InvalidStep)
                    errors.push(`invalid target address in job ${job.id}`)
                    break
                }
                if (step.value !== undefined && step.value < BigInt(0)) {
                    statuses.add(ValidatorStatus.InvalidStep)
                    errors.push(`negative value in step of job ${job.id}`)
                    break
                }
                try {
                    if (step.abi !== "") {
                        const abiFunc: any = parseAbiItem(`function ${step.abi}`)
                        if (abiFunc.inputs.length !== step.args.length) throw new Error('args length mismatch')
                        for (let i = 0; i < abiFunc.inputs.length; i++) {
                            if (!isValidArgForType(step.args[i], abiFunc.inputs[i].type)) throw new Error('arg type mismatch')
                        }
                    }
                } catch (error) {
                    console.log(error)
                    statuses.add(ValidatorStatus.InvalidStep)
                    errors.push(`invalid abi or args in step of job ${job.id}`)
                    break
                }
            }
        }

        for (const t of workflow.triggers) {
            if (t.type === 'event') {
                try {
                    parseAbiItem(`event ${t.params.signature}`)
                } catch (_) {
                    statuses.add(ValidatorStatus.InvalidTrigger)
                    errors.push('invalid event trigger signature')
                }
                if (!isAddress(t.params.contractAddress)) {
                    statuses.add(ValidatorStatus.InvalidTrigger)
                    errors.push('invalid contract address in trigger')
                }
            }
            if (t.type === 'onchain') {
                // Validate address
                if (!isAddress(t.params.target as Address)) {
                    statuses.add(ValidatorStatus.InvalidTrigger);
                    errors.push('invalid target address in onchain trigger');
                }
                try {
                    const abiFunc: any = parseAbiItem(`function ${t.params.abi}`);
                    if (abiFunc.inputs.length !== t.params.args.length) {
                        throw new Error('args length mismatch');
                    }
                    for (let i = 0; i < abiFunc.inputs.length; i++) {
                        if (!isValidArgForType(t.params.args[i], abiFunc.inputs[i].type)) {
                            throw new Error('arg type mismatch in onchain trigger');
                        }
                    }
                    // Validate onchainCondition if present
                    if (t.params.onchainCondition) {
                        const { condition, value } = t.params.onchainCondition;
                        if (value === undefined) {
                            throw new Error('onchainCondition value missing');
                        }
                        if (abiFunc.outputs.length === 0) {
                            throw new Error('ABI must define a return type when using onchainCondition');
                        }
                        const outputType: string = abiFunc.outputs[0].type;
                        const isNumericType = outputType.startsWith('uint') || outputType.startsWith('int');
                        const numericConditions = [
                            OnchainConditionOperator.GREATER_THAN,
                            OnchainConditionOperator.LESS_THAN,
                            OnchainConditionOperator.GREATER_THAN_OR_EQUAL,
                            OnchainConditionOperator.LESS_THAN_OR_EQUAL,
                        ];
                        if (numericConditions.includes(condition) && !isNumericType) {
                            throw new Error('non-numeric return type used with GREATER/LESS condition');
                        }
                    }
                } catch (error) {
                    statuses.add(ValidatorStatus.InvalidTrigger);
                    errors.push('invalid abi, args, or onchainCondition in onchain trigger');
                }
                if (!chainConfig[t.params.chainId]) {
                    statuses.add(ValidatorStatus.UnsupportedChainId);
                    errors.push(`unsupported chain ${t.params.chainId} in onchain trigger`);
                }
                if (t.params.value !== undefined) {
                    const valBig = typeof t.params.value === 'string' ? BigInt(t.params.value) : t.params.value;
                    if (valBig < BigInt(0)) {
                        statuses.add(ValidatorStatus.InvalidTrigger);
                        errors.push('negative value in onchain trigger');
                    }
                }
            }
        }

        if (errors.length === 0) return { status: ValidatorStatus.Success, errors: [] }
        return { status: [...statuses][0], errors }
    }
} 