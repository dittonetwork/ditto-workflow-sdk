import { Workflow as IWorkflow, Job as IJob, Trigger, OnchainConditionOperator } from './types';
import { Job } from './Job';
import { Account, AbiFunction, parseAbiItem } from 'viem';
import { Step } from './Step';

export class Workflow implements IWorkflow {
  public validAfter?: Date;
  public validUntil?: Date;
  public count?: number;
  public interval?: number;
  public triggers: Trigger[];
  public jobs: Job[];
  public owner: Account;

  constructor(config: IWorkflow) {
    this.count = config.count;
    this.validAfter = config.validAfter;
    this.validUntil = config.validUntil;
    this.interval = config.interval;
    this.triggers = config.triggers || [];
    this.jobs = config.jobs.map(job => new Job(job.id, job.steps, job.chainId, job.session));
    this.owner = config.owner;
  }

  addJob(job: Job | IJob): Workflow {
    if (job instanceof Job) {
      this.jobs.push(job);
    } else {
      this.jobs.push(new Job(job.id, job.steps, job.chainId));
    }
    return this;
  }

  getJobById(id: string): Job | undefined {
    return this.jobs.find(job => job.id === id);
  }

  getAllSteps(): Array<{ job: Job; step: import('./Step').Step }> {
    const allSteps: Array<{ job: Job; step: import('./Step').Step }> = [];
    for (const job of this.jobs) {
      for (const step of job.steps) {
        allSteps.push({ job, step });
      }
    }
    return allSteps;
  }

  getChainIds(): number[] {
    const chainIds = new Set<number>();
    this.jobs.forEach(job => {
      if (job.chainId) {
        chainIds.add(job.chainId);
      }
    });
    return Array.from(chainIds);
  }

  getJobsByChain(chainId: number): Job[] {
    return this.jobs.filter(job => job.chainId === chainId);
  }

  isExpired(): boolean {
    if (!this.validUntil) {
      return false;
    }
    const expiredTime = this.validUntil instanceof Date
      ? this.validUntil.getTime()
      : this.validUntil;
    return Date.now() > expiredTime;
  }

  validate(): void {
    if (this.count && this.count <= 0) {
      throw new Error('Workflow count must be greater than 0');
    }
    if (this.jobs.length === 0) {
      throw new Error('Workflow must have at least one job');
    }
    for (const job of this.jobs) {
      if (job.isEmpty()) {
        throw new Error(`Job ${job.id} has no steps`);
      }
    }
  }

  toJSON(): IWorkflow {
    return {
      count: this.count,
      validAfter: this.validAfter,
      validUntil: this.validUntil,
      interval: this.interval,
      triggers: this.triggers,
      jobs: this.jobs.map(j => j.toJSON()),
      owner: this.owner
    };
  }

  getOwner(): Account {
    return this.owner;
  }

  typify(): this {
    const coerce = (val: any, type: string) => {
      if (typeof val !== 'string') return val;
      const t = type.toLowerCase();
      if (t === 'bool') {
        const v = val.trim().toLowerCase();
        if (v === 'true') return true;
        if (v === 'false') return false;
        return Boolean(v);
      }
      if (t.startsWith('uint') || t.startsWith('int')) {
        return BigInt(val);
      }
      if (t === 'string' || t === 'address' || t.startsWith('bytes')) {
        return val;
      }
      if (t.endsWith('[]')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch { }
        return val;
      }
      return val;
    };

    const getInputTypes = (abiSig: string): string[] => {
      if (!abiSig || abiSig.trim().length === 0) return [];
      try {
        const fn = parseAbiItem(`function ${abiSig}`) as AbiFunction;
        return fn.inputs.map(i => i.type);
      } catch {
        return [];
      }
    };

    this.triggers = this.triggers.map(t => {
      if ((t as any).type === 'onchain' && (t as any).params?.abi) {
        const params: any = (t as any).params || {};
        const types = getInputTypes(params.abi);
        const args = Array.isArray(params.args)
          ? params.args.map((arg: any, i: number) => coerce(arg, types[i] ?? ''))
          : params.args;

        let onchainCondition = params.onchainCondition;
        if (onchainCondition) {
          let returnType = 'bool';
          try {
            const fn = parseAbiItem(`function ${params.abi}`) as AbiFunction;
            if (fn.outputs && fn.outputs.length > 0) {
              returnType = fn.outputs[0].type;
            }
          } catch { }

          const condOp = onchainCondition.condition as OnchainConditionOperator;
          const rawVal = onchainCondition.value;
          let newVal: any = rawVal;
          if (condOp === OnchainConditionOperator.ONE_OF) {
            if (typeof rawVal === 'string') {
              try {
                const parsed = JSON.parse(rawVal);
                if (Array.isArray(parsed)) {
                  newVal = parsed.map((v: any) => (typeof v === 'string' ? coerce(v, returnType) : v));
                } else {
                  newVal = [coerce(rawVal, returnType)];
                }
              } catch {
                const parts = rawVal.split(',').map((s: string) => s.trim()).filter(Boolean);
                newVal = parts.map(p => coerce(p, returnType));
              }
            } else if (Array.isArray(rawVal)) {
              newVal = rawVal.map(v => (typeof v === 'string' ? coerce(v, returnType) : v));
            }
          } else {
            if (typeof rawVal === 'string') {
              newVal = coerce(rawVal, returnType);
            }
          }
          onchainCondition = { ...onchainCondition, value: newVal };
        }

        return {
          ...t,
          params: {
            ...params,
            args,
            onchainCondition,
          },
        } as Trigger;
      }
      return t;
    });

    for (const job of this.jobs) {
      for (let i = 0; i < job.steps.length; i++) {
        const step = job.steps[i] as Step;
        const types = getInputTypes(step.abi);
        const newArgs = Array.isArray(step.args)
          ? step.args.map((arg, idx) => coerce(arg, types[idx] ?? ''))
          : step.args;
        job.steps[i] = new Step({
          target: step.target as any,
          abi: step.abi,
          args: newArgs as any[],
          value: step.value,
        });
      }
    }

    return this;
  }
}