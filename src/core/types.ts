import { Account, Address, Hex } from "viem";
import { Chain } from "viem";
import { ParamOperator } from "@zerodev/session-key";

export interface Step {
  target: string;
  abi: string;  // Function signature like "transfer(address,uint256)"
  args: readonly any[];
  value?: bigint;
}

export interface Job {
  id: string;
  steps: Step[];
  chainId: number;
  session?: string;
}

export interface Workflow {
  count?: number;
  validAfter?: Date;
  validUntil?: Date;
  interval?: number;
  triggers: Trigger[];
  jobs: Job[];
  owner: Account;
}

export interface SessionAction {
  target: string;
  selector: string;
}

export interface SessionPolicy {
  type: 'timeframe' | 'usageLimit' | 'call';
  data: any;
}

export interface SmartSessionConfig {
  actions: SessionAction[];
  policies: SessionPolicy[];
}

export interface ChainConfig {
  chainId: number;
  chain: Chain;
  rpcUrl: string;
  bundlerUrl: string;
  multicallAddress?: string;
}

export type Trigger = EventTrigger | CronTrigger | OnchainTrigger;

export interface EventTrigger {
  type: 'event';
  params: {
    signature: string;
    contractAddress: Address;
    chainId: number;
    filter?: Record<string, any>;
  };
}

export interface CronTrigger {
  type: 'cron';
  params: {
    schedule: string;
  };
}

export interface OnchainTrigger {
  type: 'onchain';
  params: {
    target: Address;
    abi: string;
    args: readonly any[];
    value?: bigint;
    chainId: number;
  };
}

export interface EventTriggerParams {
  signature: string;
  contractAddress: Address;
  chainId: number;
  filter?: Record<string, any>;
}

export interface CronTriggerParams {
  schedule: string;
}

export interface OnchainTriggerParams {
  target: Address;
  abi: string;
  args: readonly any[];
  value?: bigint;
  chainId: number;
}

// ZeroDev Session Types
export interface SessionPermission {
  target: Address;
  valueLimit: bigint;
  abi: any[];
  functionName: string;
  args: SessionArgument[];
}

export interface SessionArgument {
  operator: ParamOperator;
  value: any;
}

export interface ZeroDevSessionConfig {
  sessionKeyAddress: Address;
  permissions: SessionPermission[];
  paymaster?: Address;
  validUntil?: number; // Unix timestamp
  validAfter?: number; // Unix timestamp
  maxExecutions?: number; // Usage count limit
}

export interface SerializedSession {
  serializedSessionKey: string;
  sessionKeyPrivateKey: Hex;
}

export interface SessionData {
  session: SerializedSession;
  multicallData: Hex;
  totalValue: bigint;
}

export interface GasEstimate {
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
  callGasLimit: bigint;
  paymasterVerificationGasLimit?: bigint;
  paymasterPostOpGasLimit?: bigint;
}