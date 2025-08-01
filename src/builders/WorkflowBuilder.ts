import { Workflow } from '../core/Workflow';
import { Job } from '../core/Job';
import { JobBuilder } from './JobBuilder';
import { EventTriggerParams, OnchainTriggerParams, Trigger } from '../core/types';
import { PrivateKeyAccount } from 'viem/accounts';
import { Account } from 'viem';
import { WorkflowTrigger } from '../core/Trigger';

export class WorkflowBuilder {
  private count?: number;
  private validAfter?: Date;
  private validUntil?: Date;
  private interval?: number;
  private triggers: Trigger[] = [];
  private jobs: Job[] = [];
  private owner: Account;

  constructor(owner: Account) {
    this.owner = owner;
  }

  static create(owner: Account): WorkflowBuilder {
    return new WorkflowBuilder(owner);
  }

  setCount(count: number): WorkflowBuilder {
    if (count <= 0) {
      throw new Error('Count must be greater than 0');
    }
    this.count = count;
    return this;
  }
  setInterval(interval: number): WorkflowBuilder {
    if (interval <= 0) {
      throw new Error('Interval must be positive');
    }
    this.interval = interval;
    return this;
  }

  setValidAfter(validAfter: Date | number): WorkflowBuilder {
    if (typeof validAfter === 'number') {
      validAfter = new Date(validAfter);
    }
    this.validAfter = validAfter;
    return this;
  }
  setValidUntil(validUntil: Date | number): WorkflowBuilder {
    if (typeof validUntil === 'number') {
      if (validUntil <= Date.now()) {
        throw new Error('Expiration time must be in the future');
      }
      validUntil = new Date(validUntil);
    }
    this.validUntil = validUntil;
    return this;
  }

  addEventTrigger(params: EventTriggerParams): WorkflowBuilder {
    if (!params.signature || params.signature.trim().length === 0) {
      throw new Error('Event signature cannot be empty');
    }
    this.triggers.push(WorkflowTrigger.event(params));
    return this;
  }

  addCronTrigger(schedule: string): WorkflowBuilder {
    if (!schedule || schedule.trim().length === 0) {
      throw new Error('Cron schedule cannot be empty');
    }
    this.triggers.push(WorkflowTrigger.cron(schedule));
    return this;
  }

  addOnchainTrigger(params: OnchainTriggerParams): WorkflowBuilder {
    // Basic validation similar to Step
    if (!params.abi || params.abi.trim().length === 0) {
      throw new Error('ABI cannot be empty');
    }
    if (!params.target || params.target.trim().length === 0) {
      throw new Error('Target contract address cannot be empty');
    }
    this.triggers.push(WorkflowTrigger.onchain(params));
    return this;
  }

  addJob(jobOrBuilder: Job | JobBuilder): WorkflowBuilder {
    if (jobOrBuilder instanceof Job) {
      this.jobs.push(jobOrBuilder);
    } else {
      // Assume it's a JobBuilder
      this.jobs.push((jobOrBuilder as JobBuilder).build());
    }
    return this;
  }

  addJobs(jobs: (Job | JobBuilder)[]): WorkflowBuilder {
    jobs.forEach(job => this.addJob(job));
    return this;
  }

  setOwner(owner: PrivateKeyAccount): WorkflowBuilder {
    this.owner = owner;
    return this;
  }

  build(): Workflow {
    const workflow = new Workflow({
      count: this.count,
      validAfter: this.validAfter,
      validUntil: this.validUntil,
      interval: this.interval,
      triggers: this.triggers,
      owner: this.owner,
      jobs: this.jobs
    });

    workflow.validate();
    return workflow;
  }
}