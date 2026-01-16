import { Step as IStep } from './types';
import {
  encodeFunctionData,
  parseAbiItem,
  Address,
  isAddress,
  AbiFunction,
} from 'viem';

export class Step implements IStep {
  public readonly target: string;
  public readonly abi: string;
  public readonly args: readonly any[];
  public readonly value?: bigint | string; // Can be bigint or WASM/DataRef reference string
  public readonly type?: 'contract' | 'wasm';
  public readonly wasmHash?: string;
  public readonly wasmInput?: any;
  public readonly wasmId?: string;
  public readonly wasmTimeoutMs?: number;

  constructor(params: {
    target: Address;
    abi: string;
    args: readonly any[];
    value?: bigint | string; // Can be bigint or WASM/DataRef reference string
    type?: 'contract' | 'wasm';
    wasmHash?: string; // Required when type === 'wasm'
    wasmInput?: any;
    wasmId?: string;
    wasmTimeoutMs?: number;
  }) {
    // Auto-detect WASM step if wasmHash and wasmId are present, even if type is not set
    const hasWasmFields = params.wasmHash && params.wasmId;
    this.type = params.type || (hasWasmFields ? 'wasm' : 'contract');

    if (this.type === 'wasm') {
      // WASM step validation
      if (!params.wasmHash) {
        throw new Error('WASM step requires wasmHash (WASM bytes are retrieved from MongoDB by hash)');
      }
      if (!params.wasmId) {
        throw new Error('WASM step requires wasmId for result referencing');
      }
      // For WASM steps, target/abi/args are not used
      this.target = '0x0000000000000000000000000000000000000000';
      this.abi = '';
      this.args = [];
      this.value = params.value || BigInt(0);
      this.wasmHash = params.wasmHash;
      this.wasmInput = params.wasmInput;
      this.wasmId = params.wasmId;
      this.wasmTimeoutMs = params.wasmTimeoutMs;
    } else {
      // For contract steps, also store WASM fields if provided (for deserialization compatibility)
      if (params.wasmHash) this.wasmHash = params.wasmHash;
      if (params.wasmInput !== undefined) this.wasmInput = params.wasmInput;
      if (params.wasmId) this.wasmId = params.wasmId;
      if (params.wasmTimeoutMs) this.wasmTimeoutMs = params.wasmTimeoutMs;
      // Contract step validation (existing logic)
      if (!isAddress(params.target)) {
        throw new Error(`Invalid target address: ${params.target}`);
      }

      if (params.abi !== "") {
        let abiFunction: AbiFunction;
        try {
          abiFunction = parseAbiItem(`function ${params.abi}`) as AbiFunction;

        } catch (error) {
          throw new Error(`Invalid function signature: ${params.abi}`);
        }
        if (params.args.length !== abiFunction.inputs.length) {
          throw new Error('Argments length does not match ABI parameter count');
        }
      }

      this.target = params.target;
      this.abi = params.abi;
      this.args = params.args;
      this.value = params.value;
    }
  }

  getCalldata(): string {
    if (this.abi === "") {
      return "";
    }
    const abiFunction = parseAbiItem(`function ${this.abi}`) as AbiFunction;
    return encodeFunctionData({
      abi: [abiFunction],
      functionName: abiFunction.name,
      args: this.args,
    });
  }

  getAbi(): AbiFunction[] {
    if (this.abi === "") {
      return [];
    }
    const abiFunction = parseAbiItem(`function ${this.abi}`) as AbiFunction;
    return [abiFunction];
  }

  getSelector(): string {
    const calldata = this.getCalldata();
    if (calldata.length < 10) {
      throw new Error('Calldata too short to extract selector');
    }
    return calldata.slice(0, 10);
  }

  getFunctionName(): string {
    if (this.abi === "") {
      return "";
    }
    const abiFunction = parseAbiItem(`function ${this.abi}`) as AbiFunction;
    return abiFunction.name;
  }

  toJSON(): IStep {
    const base: any = {
      target: this.target,
      abi: this.abi,
      args: this.args,
      value: this.value,
    };
    if (this.type) {
      base.type = this.type;
    }
    if (this.wasmHash) base.wasmHash = this.wasmHash;
    if (this.wasmInput !== undefined) base.wasmInput = this.wasmInput;
    if (this.wasmId) base.wasmId = this.wasmId;
    if (this.wasmTimeoutMs) base.wasmTimeoutMs = this.wasmTimeoutMs;
    return base;
  }

  /**
   * Check if this is a WASM step
   */
  isWasmStep(): boolean {
    return this.type === 'wasm';
  }
}