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
  public readonly value?: bigint;

  constructor(params: {
    target: Address;
    abi: string;
    args: readonly any[];
    value?: bigint;
  }) {
    if (!isAddress(params.target)) {
      throw new Error(`Invalid target address: ${params.target}`);
    }

    let abiFunction: AbiFunction;
    try {
      abiFunction = parseAbiItem(`function ${params.abi}`) as AbiFunction;
    } catch (error) {
      throw new Error(`Invalid function signature: ${params.abi}`);
    }
    if (params.args.length !== abiFunction.inputs.length) {
      throw new Error('Arguments length does not match ABI parameter count');
    }

    this.target = params.target;
    this.abi = params.abi;
    this.args = params.args;
    this.value = params.value;
  }

  getCalldata(): string {
    const abiFunction = parseAbiItem(`function ${this.abi}`) as AbiFunction;
    return encodeFunctionData({
      abi: [abiFunction],
      functionName: abiFunction.name,
      args: this.args,
    });
  }

  getAbi(): AbiFunction[] {
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
    const abiFunction = parseAbiItem(`function ${this.abi}`) as AbiFunction;
    return abiFunction.name;
  }

  toJSON(): IStep {
    return {
      target: this.target,
      abi: this.abi,
      args: this.args,
      value: this.value
    };
  }
}