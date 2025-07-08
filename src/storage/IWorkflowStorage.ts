export interface SerializedJobWithSession {
  id: string;
  chainId: number;
  steps: Array<{
    target: string;
    abi: string;
    args: readonly any[];
    value: string;
  }>;
  session: string;
}
export interface SerializedWorkflowData {
  workflow: {
    owner: string;
    triggers: any[];
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