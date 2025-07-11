import { EventTriggerParams, Trigger } from './types';

export class WorkflowTrigger {
    readonly type: 'event' | 'cron';
    readonly params: any;

    private constructor(type: 'event' | 'cron', params: any) {
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

    toJSON(): Trigger {
        return {
            type: this.type,
            params: this.params,
        } as Trigger;
    }
} 