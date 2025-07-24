import { EventTriggerParams, OnchainTriggerParams, Trigger } from './types';

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