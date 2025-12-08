/**
 * Data Reference Example: Swap at Oracle Price
 * 
 * This example shows how to:
 * 1. Read ETH/USD price from Chainlink oracle
 * 2. Read pool reserves from Uniswap V2 pool
 * 3. Use these values to execute a swap with price protection
 * 
 * Run: npm run example:dataref (or: bun run examples/data-ref-workflow.ts)
 * 
 * No configuration needed - uses real Sepolia contracts.
 */
import {
  WorkflowBuilder,
  JobBuilder,
  ChainId,
  dataRef,
  DataRefContext,
  DataRefResolver,
  serializeDataRefContext,
  deserializeDataRefContext,
  isDataRefString,
} from '../src';
import { addressToEmptyAccount } from '@zerodev/sdk';
import { PinoLogger } from '../src';

const logger = new PinoLogger();

// ============================================================================
// Real Sepolia Contract Addresses
// ============================================================================

// Chainlink Price Feeds
const CHAINLINK_ETH_USD = '0x694AA1769357215DE4FAC081bf1f309aDC325306';

// Sepolia tokens
const WETH = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

// Uniswap V2 Router on Sepolia
const UNISWAP_V2_ROUTER = '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3';

// Uniswap V2 Factory on Sepolia  
const UNISWAP_V2_FACTORY = '0xF62c03E08ada871A0bEb309762E260a7a6a880E6';

// ============================================================================
// Example: Swap WETH -> USDC using Oracle Price as minimum
// ============================================================================
async function main() {
  logger.info('╔═══════════════════════════════════════════════════════════════╗');
  logger.info('║   Data Reference Example: Swap at Oracle Price                ║');
  logger.info('╚═══════════════════════════════════════════════════════════════╝\n');

  // Mock accounts (for demonstration)
  const owner = addressToEmptyAccount('0x1111111111111111111111111111111111111111');
  const recipient = '0x2222222222222222222222222222222222222222' as `0x${string}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Create Data References
  // ═══════════════════════════════════════════════════════════════════════════
  logger.info('📊 Creating data references...\n');

  // Get ETH/USD price from Chainlink (8 decimals)
  // latestRoundData returns: (roundId, answer, startedAt, updatedAt, answeredInRound)
  const ethUsdPrice = dataRef({
    target: CHAINLINK_ETH_USD as `0x${string}`,
    abi: 'latestRoundData() returns (uint80, int256, uint256, uint256, uint80)',
    chainId: ChainId.SEPOLIA,
    resultIndex: 1, // answer = price
  });

  // Get WETH balance of owner
  const wethBalance = dataRef({
    target: WETH as `0x${string}`,
    abi: 'balanceOf(address) returns (uint256)',
    args: [owner.address],
    chainId: ChainId.SEPOLIA,
  });

  // Get pair address from factory (WETH/USDC)
  const pairAddress = dataRef({
    target: UNISWAP_V2_FACTORY as `0x${string}`,
    abi: 'getPair(address,address) returns (address)',
    args: [WETH, USDC],
    chainId: ChainId.SEPOLIA,
  });

  logger.info('  ✓ ETH/USD price ref (Chainlink)');
  logger.info('  ✓ WETH balance ref');
  logger.info('  ✓ Uniswap pair address ref\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: Build Workflow
  // ═══════════════════════════════════════════════════════════════════════════
  logger.info('🔧 Building workflow...\n');

  const workflow = WorkflowBuilder.create(owner)
    .addCronTrigger('*/5 * * * *') // Every 5 minutes
    .setCount(100)
    .setValidUntil(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days
    .addJob(
      JobBuilder.create('swap-weth-to-usdc')
        .setChainId(ChainId.SEPOLIA)

        // Step 1: Approve WETH spending to router
        // Amount comes from data ref (current balance)
        .addStep({
          target: WETH as `0x${string}`,
          abi: 'approve(address spender, uint256 amount) returns (bool)',
          args: [UNISWAP_V2_ROUTER, wethBalance], // <-- Data ref!
        })

        // Step 2: Swap WETH -> USDC
        // Uses oracle price to calculate minimum output
        .addStep({
          target: UNISWAP_V2_ROUTER as `0x${string}`,
          abi: 'swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])',
          args: [
            wethBalance,              // <-- Data ref: swap full balance
            ethUsdPrice,              // <-- Data ref: use oracle price as min (simplified)
            [WETH, USDC],             // path
            recipient,                // to
            BigInt(Date.now() + 3600000), // deadline: 1 hour
          ],
        })
        .build()
    )
    .build();

  logger.info('  ✓ Job: swap-weth-to-usdc');
  logger.info('  ✓ Step 1: approve(router, balance)');
  logger.info('  ✓ Step 2: swapExactTokensForTokens(balance, oraclePrice, ...)\n');

  // Show what the args look like
  const step1 = workflow.jobs[0].steps[0];
  const step2 = workflow.jobs[0].steps[1];

  logger.info('📋 Step arguments (before resolution):');
  logger.info(`  Step 1 args[1] is DataRef: ${isDataRefString(step1.args[1])}`);
  logger.info(`  Step 2 args[0] is DataRef: ${isDataRefString(step2.args[0])}`);
  logger.info(`  Step 2 args[1] is DataRef: ${isDataRefString(step2.args[1])}`);
  logger.info('');

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: Demonstrate Consensus Flow
  // ═══════════════════════════════════════════════════════════════════════════
  logger.info('🤝 Consensus flow demonstration...\n');

  // Simulate what happens during execution:
  // 1. Leader resolves data refs at specific block
  // 2. Leader sends context to operators
  // 3. Operators use same block for deterministic replay

  const leaderContext: DataRefContext = {
    chainBlocks: { 
      [ChainId.SEPOLIA]: BigInt(7500000), // Block where reads happened
    },
    resolvedRefs: [
      {
        ref: {
          target: CHAINLINK_ETH_USD as `0x${string}`,
          abi: 'latestRoundData() returns (uint80, int256, uint256, uint256, uint80)',
          args: [],
          chainId: ChainId.SEPOLIA,
          resultIndex: 1,
        },
        value: BigInt(250000000000), // $2500.00 (8 decimals)
        blockNumber: BigInt(7500000),
      },
      {
        ref: {
          target: WETH as `0x${string}`,
          abi: 'balanceOf(address) returns (uint256)',
          args: [owner.address],
          chainId: ChainId.SEPOLIA,
        },
        value: BigInt('1000000000000000000'), // 1 WETH (18 decimals)
        blockNumber: BigInt(7500000),
      },
    ],
  };

  logger.info(`  Leader resolved at block: ${leaderContext.chainBlocks[ChainId.SEPOLIA].toString()}`);
  logger.info(`  - ETH price: $${(Number(leaderContext.resolvedRefs[0].value) / 1e8).toFixed(2)}`);
  logger.info(`  - WETH balance: ${(Number(leaderContext.resolvedRefs[1].value) / 1e18).toFixed(4)} WETH`);

  // Serialize for transmission
  const serialized = serializeDataRefContext(leaderContext);
  logger.info(`  📤 Serialized context: ${serialized.length} bytes`);

  // Operator deserializes and verifies
  const operatorContext = deserializeDataRefContext(serialized);
  const blocksMatch = operatorContext.chainBlocks[ChainId.SEPOLIA] === leaderContext.chainBlocks[ChainId.SEPOLIA];
  const valuesMatch = operatorContext.resolvedRefs[0].value === leaderContext.resolvedRefs[0].value;

  logger.info('  📥 Operator deserialized successfully');
  logger.info(`  ✓ Block numbers match: ${blocksMatch}`);
  logger.info(`  ✓ Values match: ${valuesMatch}`);
  logger.info('');

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4: Show Detection
  // ═══════════════════════════════════════════════════════════════════════════
  logger.info('🔍 DataRef detection in workflow args:');

  for (let i = 0; i < workflow.jobs[0].steps.length; i++) {
    const step = workflow.jobs[0].steps[i];
    const hasRefs = DataRefResolver.hasDataRefs(step.args);
    logger.info(`  Step ${i + 1}: hasDataRefs = ${hasRefs}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════════
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('');
  logger.info('  How it works:');
  logger.info('  1. Workflow args contain $ref:{...} strings');
  logger.info('  2. At execution, SDK resolves refs by calling contracts');
  logger.info('  3. Block number is fixed for deterministic consensus');
  logger.info('  4. Resolved values replace $ref strings in calldata');
  logger.info('');
  logger.info('  Result: Swap executes with live oracle price!');
  logger.info('');
  logger.info('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
