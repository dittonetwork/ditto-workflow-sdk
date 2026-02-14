/**
 * Autocompound Workflow Example
 *
 * This example demonstrates a DeFi autocompounding strategy that:
 * 1. Checks rewards balance from a yield protocol
 * 2. Claims rewards when threshold is met
 * 3. Swaps rewards for base token
 * 4. Re-deposits into the yield protocol
 *
 * Uses time-based trigger (cron) to run periodically without manual intervention.
 *
 * Run: bun run examples/autocompound-workflow.ts
 */
import {
  WorkflowBuilder,
  JobBuilder,
  ChainId,
  submitWorkflow,
  dataRef,
} from '../src';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex } from 'viem';
import * as dotenv from 'dotenv';
import { IpfsStorage } from '../src/storage/IpfsStorage';
import { baseSepolia } from 'viem/chains';
import { Signer } from '@zerodev/sdk/types';
import { addressToEmptyAccount } from '@zerodev/sdk';
import { ConsoleLogger } from '../src';

dotenv.config({ path: '.env' });

const IPFS_SERVICE_URL = process.env.IPFS_SERVICE_URL || 'https://api.ditto.network/ipfs';
const WORKFLOW_CONTRACT_ADDRESS = process.env.WORKFLOW_CONTRACT_ADDRESS as `0x${string}`;
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
const EXECUTOR_PRIVATE_KEY = process.env.EXECUTOR_PRIVATE_KEY as Hex;

const logger = new ConsoleLogger();

// ============================================================================
// Example Contract Addresses (Base Sepolia testnet)
// ============================================================================
// Note: Replace these with actual deployed contract addresses for your protocol

// Mock Yield Protocol (Staking/Farming contract)
const YIELD_PROTOCOL = '0x1234567890123456789012345678901234567890' as `0x${string}`;

// Mock Reward Token (e.g., protocol governance token)
const REWARD_TOKEN = '0x2345678901234567890123456789012345678901' as `0x${string}`;

// Mock Base Token (e.g., USDC, ETH)
const BASE_TOKEN = '0x3456789012345678901234567890123456789012' as `0x${string}`;

// Mock DEX Router (e.g., Uniswap V2/V3)
const DEX_ROUTER = '0x4567890123456789012345678901234567890123' as `0x${string}`;

// Minimum reward threshold to trigger autocompound (in token units)
const REWARD_THRESHOLD = BigInt(1000000000000000000); // 1 token (18 decimals)

/**
 * Creates an autocompound workflow that runs on a schedule
 */
async function createAutocompoundWorkflow(
    ownerAccount: Signer,
    executorAccountAddress: `0x${string}`,
    storage: IpfsStorage
) {
    logger.info('🔄 Creating Autocompound Workflow...\n');

    // Create a data reference to fetch pending rewards
    const pendingRewards = dataRef({
        target: YIELD_PROTOCOL,
        abi: 'pendingRewards(address user) returns (uint256)',
        args: [ownerAccount.address!],
        chainId: ChainId.BASE_SEPOLIA,
    });

    const workflow = WorkflowBuilder.create(addressToEmptyAccount(ownerAccount.address!))
        // Run every hour (can be adjusted based on strategy)
        .addCronTrigger("0 * * * *")

        // Optional: Add onchain trigger to only execute when rewards > threshold
        .addOnchainTrigger({
            target: YIELD_PROTOCOL,
            abi: 'pendingRewards(address user) returns (uint256)',
            args: [ownerAccount.address!],
            chainId: ChainId.BASE_SEPOLIA,
            onchainCondition: {
                condition: 1, // GREATER_THAN
                value: REWARD_THRESHOLD,
            }
        })

        // Run indefinitely (no count limit)
        .setValidAfter(Date.now() - 60 * 60 * 1000) // Valid from 1 hour ago
        .setValidUntil(Date.now() + 365 * 24 * 60 * 60 * 1000) // Valid for 1 year
        .setInterval(3600) // Minimum 1 hour between executions

        .addJob(
            JobBuilder.create("autocompound-job")
                .setChainId(ChainId.BASE_SEPOLIA)

                // Step 1: Claim rewards from yield protocol
                .addStep({
                    target: YIELD_PROTOCOL,
                    abi: "claimRewards()",
                    args: [],
                    value: BigInt(0)
                })

                // Step 2: Approve DEX router to spend reward tokens
                .addStep({
                    target: REWARD_TOKEN,
                    abi: "approve(address spender, uint256 amount) returns (bool)",
                    args: [DEX_ROUTER, pendingRewards], // Use data ref for exact amount
                    value: BigInt(0)
                })

                // Step 3: Swap reward tokens for base token
                .addStep({
                    target: DEX_ROUTER,
                    abi: "swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
                    args: [
                        pendingRewards,                         // Amount from data ref
                        BigInt(0),                             // Min output (should use oracle in production)
                        [REWARD_TOKEN, BASE_TOKEN],            // Swap path
                        ownerAccount.address!,                 // Recipient
                        BigInt(Date.now() + 3600000)          // Deadline: 1 hour from now
                    ],
                    value: BigInt(0)
                })

                // Step 4: Get base token balance for re-deposit
                // (In production, would use data ref to get exact balance)

                // Step 5: Approve yield protocol to spend base tokens
                .addStep({
                    target: BASE_TOKEN,
                    abi: "approve(address spender, uint256 amount) returns (bool)",
                    args: [
                        YIELD_PROTOCOL,
                        BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935") // max uint256
                    ],
                    value: BigInt(0)
                })

                // Step 6: Re-deposit base tokens into yield protocol
                .addStep({
                    target: YIELD_PROTOCOL,
                    abi: "deposit(uint256 amount)",
                    args: [
                        pendingRewards // Simplified - in production would use actual base token amount
                    ],
                    value: BigInt(0)
                })

                .build()
        )
        .build();

    logger.info('✅ Workflow structure created');
    logger.info('📋 Triggers:');
    logger.info('   - Cron: Every hour (0 * * * *)');
    logger.info('   - Onchain: When rewards > threshold');
    logger.info('📋 Steps:');
    logger.info('   1. Claim rewards from protocol');
    logger.info('   2. Approve DEX router');
    logger.info('   3. Swap rewards → base token');
    logger.info('   4. Approve yield protocol');
    logger.info('   5. Re-deposit into protocol');
    logger.info('');

    // Submit workflow to IPFS and registry
    const response = await submitWorkflow(
        workflow,
        executorAccountAddress,
        storage,
        ownerAccount,
        false, // Use test contracts
        IPFS_SERVICE_URL
    );

    return response;
}

async function main() {
    try {
        if (!OWNER_PRIVATE_KEY || !EXECUTOR_PRIVATE_KEY || !WORKFLOW_CONTRACT_ADDRESS) {
            throw new Error('Missing required environment variables. Please check your .env file.');
        }

        logger.info("🚀 Autocompound Workflow Example\n");
        logger.info("════════════════════════════════════════════════════════════\n");

        // Initialize accounts
        const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
        const executorAccount = privateKeyToAccount(EXECUTOR_PRIVATE_KEY);
        const executorAddress = executorAccount.address;

        logger.info(`👤 Owner: ${ownerAccount.address}`);
        logger.info(`⚙️  Executor: ${executorAddress}\n`);

        // Initialize IPFS storage
        const storage = new IpfsStorage(IPFS_SERVICE_URL);

        // Create and submit workflow
        const response = await createAutocompoundWorkflow(
            ownerAccount,
            executorAddress,
            storage
        );

        logger.info("════════════════════════════════════════════════════════════\n");
        logger.info("✅ Autocompound Workflow Created Successfully!\n");
        logger.info("📋 Details:");
        logger.info(`   IPFS Hash: ${response.ipfsHash}`);
        logger.info(`   Transaction Hashes: ${response.userOpHashes.map(op => op.receipt?.transactionHash).filter(Boolean).join(', ')}`);
        logger.info('');
        logger.info("🎯 What happens next:");
        logger.info("   1. Workflow runs every hour automatically");
        logger.info("   2. Checks if rewards > threshold");
        logger.info("   3. Claims, swaps, and re-deposits");
        logger.info("   4. Compounds your yield without gas fees!");
        logger.info('');

    } catch (error) {
        logger.error("❌ Workflow creation failed:", error);
        process.exit(1);
    }
}

main();
