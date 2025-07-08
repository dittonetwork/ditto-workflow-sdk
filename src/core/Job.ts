import { Job as IJob, Step as IStep } from './types';
import { Step } from './Step';
import { Address } from 'viem';

export class Job implements IJob {
  public readonly steps: Step[] = [];
  public session?: string;
  constructor(
    public readonly id: string,
    steps: IStep[] = [],
    public readonly chainId: number,
    session?: string
  ) {
    this.steps = steps.map(s => {
      if (s instanceof Step) {
        return s;
      }
      // Create Step from IStep data
      return new Step({
        target: s.target as Address,
        abi: s.abi,
        args: s.args,
        value: s.value
      });
    });
    this.session = session;
  }

  addStep(step: Step | IStep): Job {
    if (step instanceof Step) {
      this.steps.push(step);
    } else {
      this.steps.push(new Step({
        target: step.target as Address,
        abi: step.abi,
        args: step.args,
        value: step.value
      }));
    }
    return this;
  }

  getStepCount(): number {
    return this.steps.length;
  }

  isEmpty(): boolean {
    return this.steps.length === 0;
  }

  toJSON(): IJob {
    return {
      id: this.id,
      steps: this.steps.map(s => s.toJSON()),
      chainId: this.chainId,
      session: this.session
    };
  }
}