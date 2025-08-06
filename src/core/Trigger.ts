import { EventTriggerParams, OnchainTriggerParams, Trigger, OnchainConditionOperator } from './types';
import { parseAbiItem, AbiFunction } from 'viem';

export class WorkflowTrigger {
    readonly type: 'event' | 'cron' | 'onchain';
    readonly params: any;

    private constructor(type: 'event' | 'cron' | 'onchain', params: any) {
        this.type = type;
        this.params = params;
    }

    static event(params: EventTriggerParams): WorkflowTrigger {
        if (!params.signature || params.signature.trim().length === 0) {
            throw new Error('Event signature cannot be empty');
        }
        return new WorkflowTrigger('event', { ...params });
    }

    static cron(schedule: string): WorkflowTrigger {
        if (!schedule || schedule.trim().length === 0) {
            throw new Error('Cron schedule cannot be empty');
        }
        return new WorkflowTrigger('cron', { schedule });
    }

    static onchain(params: OnchainTriggerParams): WorkflowTrigger {
        if (!params.abi || params.abi.trim().length === 0) {
            throw new Error('Onchain trigger ABI cannot be empty');
        }
        if (!params.target || params.target.trim().length === 0) {
            throw new Error('Onchain trigger target cannot be empty');
        }
        // Validate condition if provided
        if (params.onchainCondition) {
            const { condition, value } = params.onchainCondition;
            // Basic sanity check for condition value presence
            if (value === undefined) {
                throw new Error('onchainCondition.value must be provided');
            }
            // Validate ABI has a return type compatible with the condition
            try {
                const abiFunc = parseAbiItem(`function ${params.abi}`) as AbiFunction;
                if (abiFunc.outputs.length === 0) {
                    throw new Error('ABI must specify at least one return value to use onchainCondition');
                }
                const outputType = abiFunc.outputs[0].type;
                const isNumericType = outputType.startsWith('uint') || outputType.startsWith('int');
                const numericConditions = [
                    OnchainConditionOperator.GREATER_THAN,
                    OnchainConditionOperator.LESS_THAN,
                    OnchainConditionOperator.GREATER_THAN_OR_EQUAL,
                    OnchainConditionOperator.LESS_THAN_OR_EQUAL,
                ];
                if (numericConditions.includes(condition) && !isNumericType) {
                    throw new Error('GREATER/LESS conditions can be used only with numeric return types');
                }
            } catch (err) {
                if (err instanceof Error) {
                    throw err;
                }
                throw new Error('Failed to parse ABI when validating onchainCondition');
            }
        }
        return new WorkflowTrigger('onchain', { ...params });
    }

    toJSON(): Trigger {
        const paramsCopy = { ...this.params } as any;
        if (this.type === 'onchain' && paramsCopy.value !== undefined) {
            paramsCopy.value = paramsCopy.value.toString();
        }
        return {
            type: this.type,
            params: paramsCopy,
        } as Trigger;
    }
} 