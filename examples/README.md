# Ditto Workflow SDK Examples

This directory contains example workflows demonstrating various use cases for the Ditto Workflow SDK.

## Available Examples

### 1. Basic Workflows

#### `create-workflow.ts`
Simple NFT minting workflow with cron trigger.
- **Trigger**: Every 2 minutes
- **Actions**: Mints NFT and fetches oracle data
- **Run**: `bun run example:create`

#### `complete-workflow-example.ts`
Complete workflow lifecycle example with native ETH transfers.
- **Trigger**: Every minute
- **Actions**: Multiple ETH transfers
- **Run**: `bun run example:complete`

#### `execute-workflow.ts`
Example of executing an existing workflow from IPFS.
- **Run**: `bun run example:execute`

### 2. Advanced Workflows

#### `data-ref-workflow.ts`
Demonstrates data references for dynamic values.
- **Use Case**: Swap WETH → USDC using Chainlink oracle price
- **Features**:
  - Data references for oracle prices
  - Data references for token balances
  - Dynamic swap amounts
- **Run**: `bun run example:dataref`

### 3. DeFi Use Cases

#### `autocompound-workflow.ts` ⭐
Automated yield compounding strategy.
- **Use Case**: Auto-compound DeFi yields without gas fees
- **Trigger**: Hourly + onchain condition (rewards > threshold)
- **Workflow**:
  1. Claim rewards from yield protocol
  2. Approve DEX router
  3. Swap rewards → base token
  4. Approve yield protocol
  5. Re-deposit into protocol
- **Features**:
  - Time-based trigger (no manual intervention)
  - Onchain condition (only executes when profitable)
  - Data references for exact reward amounts
- **Run**: `bun run example:autocompound`

#### `aave-claim-workflow.ts` ⭐
Periodic Aave rewards claiming and distribution.
- **Use Case**: Automatically claim and distribute Aave lending rewards
- **Trigger**: Daily + onchain condition (rewards available)
- **Workflow**:
  1. Claim rewards using `claimRewardsOnBehalf`
  2. Transfer to recipient address
- **Variants**:
  - Standard: Claim + Transfer (2 steps)
  - Optimized: ClaimAll direct to recipient (1 step)
- **Features**:
  - Periodic execution (daily)
  - No gas fees for claiming
  - Supports multiple assets
- **Run**: `bun run example:aave`

## Configuration

All examples require environment variables in `.env`:

```bash
# Required
PRIVATE_KEY=0x...                    # Owner private key
EXECUTOR_PRIVATE_KEY=0x...          # Executor private key
WORKFLOW_CONTRACT_ADDRESS=0x...     # Ditto Workflow Registry address

# Optional
IPFS_SERVICE_URL=https://api.ditto.network/ipfs
```

See `.env.example` for reference.

## Running Examples

### Using Bun (Recommended)
```bash
bun run example:autocompound
bun run example:aave
bun run example:dataref
```

### Using npm
```bash
npm run example:autocompound
npm run example:aave
npm run example:dataref
```

## Example Output

When you run an example, you'll see:
1. Workflow structure summary
2. IPFS hash where workflow is stored
3. Transaction hashes for on-chain registration
4. Next steps information

Example:
```
✅ Autocompound Workflow Created Successfully!

📋 Details:
   IPFS Hash: QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
   Transaction Hashes: 0x1234...

🎯 What happens next:
   1. Workflow runs every hour automatically
   2. Checks if rewards > threshold
   3. Claims, swaps, and re-deposits
   4. Compounds your yield without gas fees!
```

## Use Case Patterns

### Time-Based Automation
- **Cron triggers**: Run at specific times (`0 * * * *` = hourly)
- **Examples**: autocompound, aave-claim

### Condition-Based Execution
- **Onchain triggers**: Only execute when conditions are met
- **Examples**: All advanced examples use onchain conditions

### Data References
- **Dynamic values**: Fetch on-chain data at execution time
- **Examples**: data-ref-workflow, autocompound

### No-Gas Execution
- **Account abstraction**: Users don't pay gas fees
- **Session keys**: Pre-authorized actions
- **All examples** support gasless execution

## Creating Your Own Workflow

1. Start with a simple example (`create-workflow.ts`)
2. Add triggers based on your needs (cron, event, onchain)
3. Define steps using the builder pattern
4. Use data references for dynamic values
5. Submit to IPFS and registry

Example structure:
```typescript
const workflow = WorkflowBuilder.create(owner)
  .addCronTrigger("0 * * * *")
  .addOnchainTrigger({ /* condition */ })
  .setValidUntil(Date.now() + 365 * 24 * 60 * 60 * 1000)
  .addJob(
    JobBuilder.create("my-job")
      .setChainId(ChainId.BASE_SEPOLIA)
      .addStep({ /* step 1 */ })
      .addStep({ /* step 2 */ })
      .build()
  )
  .build();
```

## Support

For questions or issues, please:
- Open an issue on GitHub
- Check the main README.md for SDK documentation
- Review existing examples for patterns

## Contributing

New example contributions are welcome! Please ensure:
- Clear use case description
- Commented code explaining each step
- npm script entry in package.json
- Documentation in this README
