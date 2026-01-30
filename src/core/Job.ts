import { Job as IJob, Step as IStep } from './types';
import { Step } from './Step';
import { Address } from 'viem';
import { isWasmRefString, isDataRefString } from './WasmRefResolver';

// Helper to safely convert value to BigInt, preserving WASM/DataRef references
function safeValueToBigInt(value: unknown): bigint | string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') {
    const strValue = value as string;
    // Preserve WASM and DataRef references as strings
    if (isWasmRefString(strValue) || isDataRefString(strValue)) {
      return strValue;
    }
    // Convert numeric strings to BigInt
    try {
      return BigInt(strValue);
    } catch {
      // If conversion fails, return as string (might be a reference)
      return strValue;
    }
  }
  // For numbers, convert to BigInt
  if (typeof value === 'number') return BigInt(value);
  return undefined;
}

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
      const stepParams: any = {
        target: s.target as Address,
        abi: s.abi,
        args: s.args,
        value: safeValueToBigInt(s.value),
      };
      // Include WASM fields if present - MUST include type for WASM steps
      if ((s as any).type) stepParams.type = (s as any).type;
      if ((s as any).wasmHash) stepParams.wasmHash = (s as any).wasmHash;
      if ((s as any).wasmInput !== undefined) stepParams.wasmInput = (s as any).wasmInput;
      if ((s as any).wasmId) stepParams.wasmId = (s as any).wasmId;
      if ((s as any).wasmTimeoutMs) stepParams.wasmTimeoutMs = (s as any).wasmTimeoutMs;
      return new Step(stepParams);
    });
    this.session = session;
  }

  addStep(step: Step | IStep): Job {
    if (step instanceof Step) {
      this.steps.push(step);
    } else {
      const stepParams: any = {
        target: step.target as Address,
        abi: step.abi,
        args: step.args,
        value: step.value,
      };
      // Include WASM fields if present
      if ((step as any).type) stepParams.type = (step as any).type;
      if ((step as any).wasmHash) stepParams.wasmHash = (step as any).wasmHash;
      if ((step as any).wasmInput !== undefined) stepParams.wasmInput = (step as any).wasmInput;
      if ((step as any).wasmId) stepParams.wasmId = (step as any).wasmId;
      if ((step as any).wasmTimeoutMs) stepParams.wasmTimeoutMs = (step as any).wasmTimeoutMs;
      this.steps.push(new Step(stepParams));
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