import { Job } from '../core/Job';
import { Step } from '../core/Step';
import { Step as IStep } from '../core/types';

export class JobBuilder {
  private id: string;
  private steps: (Step | IStep)[] = [];
  private chainId: number = 0;

  constructor(id: string) {
    this.id = id;
  }

  static create(id: string): JobBuilder {
    return new JobBuilder(id);
  }

  setChainId(chainId: number): JobBuilder {
    this.chainId = chainId;
    return this;
  }

  addStep(step: Step | IStep): JobBuilder {
    this.steps.push(step);
    return this;
  }

  addSteps(steps: (Step | IStep)[]): JobBuilder {
    steps.forEach(step => this.addStep(step));
    return this;
  }

  build(): Job {
    if (this.steps.length === 0) {
      throw new Error('Job must have at least one step');
    }
    if (this.chainId <= 0) {
      throw new Error('Chain ID must be greater than 0');
    }
    return new Job(this.id, this.steps, this.chainId);
  }
}