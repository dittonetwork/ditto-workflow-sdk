# @ditto/workflow-sdk

TypeScript SDK for declarative authoring and execution of on-chain workflows using ZeroDev Smart Sessions.

> **Goal** – allow a developer to describe a sequence of transactions as data, upload it to IPFS, register a single CID on-chain and execute the whole flow without manually signing every call.

---

## 1. Core Concepts

1. **Workflow** – the root object that groups:
   * metadata (owner, lifetime, execution limits);
   * triggers – conditions that must be satisfied before execution;
   * a collection of **Job** objects.
2. **Job** – an isolated list of steps for a single EVM chain (`chainId`). When a workflow is published a **Session Key** is automatically created for each job and used to sign all related operations.
3. **Step** – a single contract call: `target` address, ABI signature, arguments and optional `value` (ETH).
4. **Trigger** – an execution condition. Three types are supported:
   * `cron` – executed when the provided CRON expression matches the current UTC time.
   * `event` – executed after a specific event (`contractAddress`, `signature`, optional `filter`) is emitted on a given `chainId`.
   * `onchain` – executed when the value returned by a `view`/`pure` call (`target`, `abi`, `args`) satisfies the defined `onchainCondition` (e.g. `GREATER_THAN 100`).
5. **Storage** – external repository for workflow description (IPFS by default).
6. **Registry** – Ditto Workflow Registry smart-contract that stores published workflow CIDs.

---

## 2. Workflow Object Specification

```text
Workflow {
  owner:            Address,                // workflow owner
  count?:           number,                 // max number of runs (∞ if undefined)
  validAfter?:      number|Date,            // unix seconds / Date after which the workflow is valid
  validUntil?:      number|Date,            // unix seconds / Date until which the workflow is valid
  interval?:        number,                 // minimal interval between runs (seconds)
  triggers:         Trigger[],              // execution conditions
  jobs:             Job[]                   // steps grouped by chain
}

Trigger := CronTrigger | EventTrigger | OnchainTrigger

CronTrigger {
  type:   'cron',
  params: {
    schedule: string                        // standard CRON expression
  }
}

EventTrigger {
  type:   'event',
  params: {
    chainId:         number,
    contractAddress: Address,
    signature:       string,                // "Transfer(address,address,uint256)"
    filter?:         Record<string, any>    // indexed argument filters
  }
}

OnchainTrigger {
  type:   'onchain',
  params: {
    chainId:          number,
    target:           Address,
    abi:              string,               // view / pure function
    args:             readonly any[],       // call arguments
    value?:           bigint,               // ETH value to send (optional, usually 0)
    onchainCondition?: {
      condition: OnchainConditionOperator,
      value:     any
    }
  }
}

OnchainConditionOperator :=
  EQUAL | NOT_EQUAL |
  GREATER_THAN | GREATER_THAN_OR_EQUAL |
  LESS_THAN | LESS_THAN_OR_EQUAL |
  ONE_OF

Job {
  id:       string,                         // arbitrary identifier
  chainId:  number,
  steps:    Step[],
  session?: string                          // generated automatically
}

Step {
  target: Address,
  abi:    string,                           // "transfer(address,uint256)" or "" for raw call
  args:   readonly any[],
  value?: bigint                            // ETH value in wei
}
```

### Trigger evaluation

All triggers attached to a workflow are evaluated by the off-chain executor before each run:

• **CronTrigger** – satisfied when the current UTC time matches the provided CRON expression.

• **EventTrigger** – satisfied when an event that matches `signature` (and `filter`, if provided) is observed on the specified `chainId`. The executor stores the block number of the last match to prevent double execution.

• **OnchainTrigger** – satisfied when the first value returned by the call to `abi` meets the comparison defined by `onchainCondition`. Numeric operators (`GREATER_THAN`, `LESS_THAN`, etc.) are only allowed for numeric return types. For `ONE_OF` the return value must be present inside the supplied array.

All triggers in the `triggers` array are combined with logical **AND**. If the array is empty the workflow is considered always eligible for execution.

---

---

## 3. Workflow Life-cycle

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant IPFS
    participant Registry as DittoWFRegistry
    participant Executor as Off-chain Executor
    Note over Dev: 1. Build a Workflow (Builder API)
    Dev->Dev: WorkflowBuilder ✅
    Note over Dev,IPFS: 2. Serialize and upload to IPFS
    Dev->>IPFS: upload(serialized)
    IPFS-->>Dev: CID
    Note over Dev,Registry: 3. Register the workflow on-chain
    Dev->>Registry: createWorkflow(CID)
    Registry-->>Dev: txHash
    Note over Executor: 4. Executor checks triggers & validity
    Executor->>Registry: scan for active CIDs
    Executor->>IPFS: download(CID)
    Executor->>Executor: Validation & trigger evaluation
    alt success
      Executor->>Executor: executeJob(s)
      Executor->>Registry: markRun(CID)
    end
```

---

## 4. Quick Start

### Installation

```bash
npm install @ditto/workflow-sdk
```

### Building & Publishing a Workflow

```typescript
import {
  WorkflowBuilder,
  JobBuilder,
  submitWorkflow,
  IpfsStorage,
  ChainId,
} from '@ditto/workflow-sdk';

const owner = /* ZeroDev Signer */;
const storage = new IpfsStorage('https://api.ditto.network/ipfs');

const workflow = WorkflowBuilder.create(owner)
  .setCount(5)
  .setValidUntil(Date.now() + 24 * 60 * 60 * 1000)
  .addTriggerCron('0 */1 * * *')
  .addJob(
    JobBuilder.create('disperse')
      .setChainId(ChainId.SEPOLIA)
      .addStep({
        target: '0x…',
        abi: 'transfer(address,uint256)',
        args: ['0x…', BigInt(1e18)],
      })
      .build(),
  )
  .build();

const { ipfsHash, txHash } = await submitWorkflow(
  workflow,
  /* executor */ owner.address,
  storage,
  owner,
);
```

### Execution (off-chain executor)

---

### Comprehensive example

Below is a minimal yet complete snippet that exercises every concept: three trigger types, multiple jobs on different chains and full submission / simulation:

```typescript
import {
  WorkflowBuilder,
  JobBuilder,
  ChainId,
  submitWorkflow,
  executeFromIpfs,
  IpfsStorage,
  OnchainConditionOperator,
} from '@ditto/workflow-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, sepolia } from 'viem/chains';

const owner = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const executor = privateKeyToAccount(process.env.EXECUTOR_KEY as `0x${string}`);
const storage = new IpfsStorage(process.env.IPFS_SERVICE_URL!);

const workflow = WorkflowBuilder.create(owner)
  // triggers
  .addCronTrigger('*/5 * * * *')
  .addEventTrigger({
    signature: 'Transfer(address,address,uint256)',
    contractAddress: '0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEAD0000',
    chainId: ChainId.SEPOLIA,
  })
  .addOnchainTrigger({
    chainId: ChainId.BASE_SEPOLIA,
    target: '0xfeedBEEFfeedbeEFfEEdbeEfFeEdbEEFFeed0000',
    abi: 'balanceOf(address) view returns (uint256)',
    args: [owner.address],
    onchainCondition: {
      condition: OnchainConditionOperator.GREATER_THAN,
      value: 0n,
    },
  })
  // limits
  .setCount(3)
  .setInterval(300)
  .setValidUntil(Date.now() + 24 * 60 * 60 * 1000)
  // job on Sepolia
  .addJob(
    JobBuilder.create('erc20-airdrop')
      .setChainId(sepolia.id)
      .addStep({
        target: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        abi: 'transfer(address,uint256)',
        args: [executor.address, 1_000_000n],
      })
      .build(),
  )
  // job on Base Sepolia
  .addJob(
    JobBuilder.create('greet')
      .setChainId(baseSepolia.id)
      .addStep({
        target: '0x1234123412341234123412341234123412341234',
        abi: 'setGreeting(string)',
        args: ['Hello, Ditto!'],
      })
      .build(),
  )
  .build();

const { ipfsHash } = await submitWorkflow(workflow, executor.address, storage, owner);

await executeFromIpfs(ipfsHash, storage, executor, 0n, true);
```

This example demonstrates:

* `CronTrigger`, `EventTrigger`, `OnchainTrigger` working together.
* Two `Job` objects targeting different EVM chains.
* Submission to IPFS + registry and dry-run execution (simulate=true).

---

```typescript
import { executeFromIpfs } from '@ditto/workflow-sdk';

await executeFromIpfs(ipfsHash, storage, executorSigner, 0n);
```

---

## 5. Validation

`WorkflowValidator` checks:
* ABI signatures, argument count and address formats;
* presence and authority of Session Keys;
* time windows (`validAfter`, `validUntil`);
* JSON schema compliance (powered by `zod`).

---

## 6. Features & Limitations

* Only EVM chains listed in `src/utils/chainConfigProvider.ts` are supported.
* `Step.abi === ""` enables raw call without ABI encoding (e.g. for proxy contracts).
* A single workflow may include jobs for multiple chains; they are executed in parallel.
* To use a paymaster set `usePaymaster: true` in `execute` / `executeFromIpfs`.

---

## 7. Environment Variables

```env
ZERODEV_API_KEY=<api-key>
IPFS_SERVICE_URL=https://api.ditto.network/ipfs
```

---

## 8. Roadmap

1. **Visual Workflow Builder** – GUI for composing JSON descriptions.
2. **Docker runner** – daemon service that executes published workflows.
3. **Monitoring** – Prometheus / Datadog metrics for execution success & performance.

---

MIT License
