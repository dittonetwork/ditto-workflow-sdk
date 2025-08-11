import { CronTrigger, EventTrigger, OnchainCondition, OnchainTrigger, OnchainTriggerParams, Trigger } from '../core/types';

export interface SerializedJobWithSession {
  id: string;
  chainId: number;
  steps: Array<{
    target: string;
    abi: string;
    args: readonly string[];
    value: string;
  }>;
  session: string;
}

export interface SerializedEventTrigger {
  type: 'event';
  params: {
    signature: string;
    contractAddress: string;
    chainId: number;
    filter: Record<string, string>;
  };
}

export interface SerializedOnchainTrigger {
  type: 'onchain';
  params: {
    target: string;
    abi: string;
    args: readonly string[];
    value: string;
    chainId: number;
    onchainCondition: {
      condition: string;
      value: string;
    };
  };
}

export type SerializedTrigger = SerializedOnchainTrigger | CronTrigger | SerializedEventTrigger;

export interface SerializedWorkflowData {
  workflow: {
    owner: string;
    triggers: SerializedTrigger[];
    jobs: SerializedJobWithSession[],
    count?: number;
    validAfter?: number;
    validUntil?: number;
    interval?: number;
  };
  metadata: {
    createdAt: number;
    version: string;
  };
}

export interface IWorkflowStorage {
  upload(data: SerializedWorkflowData): Promise<string>;
  download(id: string): Promise<SerializedWorkflowData>;
} 