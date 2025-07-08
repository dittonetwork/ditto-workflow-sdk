import { Workflow as IWorkflow, Job as IJob, Trigger } from './types';
import { Job } from './Job';
import { Account } from 'viem';

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
}