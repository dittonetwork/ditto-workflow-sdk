# @ditto/workflow-sdk

![CI](https://github.com/ditto/workflow-sdk/workflows/CI/badge.svg)

TypeScript SDK for creating and managing workflows with ZeroDev Smart Sessions

## Quick Start

### Installation

```bash
npm install @ditto/workflow-sdk
```

### Basic Usage

```typescript
import { 
  WorkflowBuilder, 
  JobBuilder, 
  ChainId,
  submitWorkflow,
  IpfsStorage
} from '@ditto/workflow-sdk';

// Create workflow
const workflow = WorkflowBuilder.create(ownerAccount)
  .setCount(3)
  .setValidUntil(Date.now() + 24 * 60 * 60 * 1000)
  .addJob(
    JobBuilder.create("my-job")
      .setChainId(ChainId.SEPOLIA)
      .addStep({
        target: "0x...",
        abi: "transfer(address,uint256)",
        args: ["0x...", BigInt(100)],
        value: BigInt(0)
      })
      .build()
  )
  .build();

// Submit to IPFS and create on-chain
const storage = new IpfsStorage(process.env.IPFS_SERVICE_URL);

const result = await submitWorkflow(
  workflow,
  executorAddress,
  storage,
  ownerSigner
);
```

## Environment Variables

Create a `.env` file with:

```env
ZERODEV_API_KEY=<api key>
IPFS_SERVICE_URL=https://api.ditto.network/ipfs
```

## Features

- **Workflow Management**: Create complex multi-step workflows
- **Session Keys**: Secure execution with ZeroDev session keys
- **Multi-chain Support**: Execute workflows across different chains
- **IPFS Storage**: Decentralized workflow storage
- **Type Safety**: Full TypeScript support with strict types
- **Validation**: Built-in validation with detailed error messages
- **Logging**: Configurable logging interface

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint
```

## License

MIT
