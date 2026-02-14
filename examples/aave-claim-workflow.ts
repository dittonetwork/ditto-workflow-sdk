/**
 * Aave Umbrella Claim Workflow Example
 *
 * This example demonstrates periodic claiming from Aave Umbrella:
 * 1. Checks claimable rewards using claimOnBehalf
 * 2. Claims rewards periodically
 * 3. Transfers claimed tokens to a specified address
 *
 * Based on issue #22: "Aave umbrella has the necessary function (claimOnBehalf)"
 * Periodic claim + transfer workflow for Aave V3 markets
 *
 * Run: bun run examples/aave-claim-workflow.ts
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
// Aave V3 Contract Addresses (Sepolia Testnet)
// ============================================================================
// Reference: https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses

// Aave V3 Rewards Controller (handles claiming)
const AAVE_REWARDS_CONTROLLER = '0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb' as `0x${string}`;

// Example aToken address (aUSDC on Sepolia)
const A_USDC_SEPOLIA = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8' as `0x${string}`;

// Example reward token (could be AAVE token or other incentive tokens)
const REWARD_TOKEN = '0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a' as `0x${string}`;

// Destination address for claimed rewards
const RECIPIENT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as `0x${string}`;

/**
 * Creates a workflow for periodic Aave reward claiming
 */
async function createAaveClaimWorkflow(
    ownerAccount: Signer,
    executorAccountAddress: `0x${string}`,
    storage: IpfsStorage,
    recipientAddress: `0x${string}`
) {
    logger.info('💰 Creating Aave Claim Workflow...\n');

    // Create data reference to check claimable rewards
    const claimableRewards = dataRef({
        target: AAVE_REWARDS_CONTROLLER,
        abi: 'getUserRewards(address[] assets, address user, address reward) returns (uint256)',
        args: [
            [A_USDC_SEPOLIA], // Array of aToken addresses to check
            ownerAccount.address!,
            REWARD_TOKEN
        ],
        chainId: ChainId.SEPOLIA,
    });

    const workflow = WorkflowBuilder.create(addressToEmptyAccount(ownerAccount.address!))
        // Run daily at midnight UTC
        .addCronTrigger("0 0 * * *")

        // Only execute if there are claimable rewards
        .addOnchainTrigger({
            target: AAVE_REWARDS_CONTROLLER,
            abi: 'getUserRewards(address[] assets, address user, address reward) returns (uint256)',
            args: [
                [A_USDC_SEPOLIA],
                ownerAccount.address!,
                REWARD_TOKEN
            ],
            chainId: ChainId.SEPOLIA,
            onchainCondition: {
                condition: 1, // GREATER_THAN
                value: BigInt(0), // Claim if any rewards available
            }
        })

        .setValidAfter(Date.now() - 60 * 60 * 1000)
        .setValidUntil(Date.now() + 365 * 24 * 60 * 60 * 1000) // Valid for 1 year
        .setInterval(86400) // Minimum 24 hours between executions

        .addJob(
            JobBuilder.create("aave-claim-job")
                .setChainId(ChainId.SEPOLIA)

                // Step 1: Claim rewards using claimRewardsOnBehalf
                // This function allows claiming on behalf of the user
                .addStep({
                    target: AAVE_REWARDS_CONTROLLER,
                    abi: "claimRewardsOnBehalf(address[] assets, uint256 amount, address user, address to, address reward) returns (uint256)",
                    args: [
                        [A_USDC_SEPOLIA],           // Assets to claim from
                        claimableRewards,           // Amount to claim (from data ref)
                        ownerAccount.address!,      // User to claim for
                        ownerAccount.address!,      // Initial recipient (owner's account)
                        REWARD_TOKEN                // Reward token address
                    ],
                    value: BigInt(0)
                })

                // Step 2: Transfer claimed rewards to final recipient
                .addStep({
                    target: REWARD_TOKEN,
                    abi: "transfer(address to, uint256 amount) returns (bool)",
                    args: [
                        recipientAddress,
                        claimableRewards // Transfer full claimed amount
                    ],
                    value: BigInt(0)
                })

                .build()
        )
        .build();

    logger.info('✅ Workflow structure created');
    logger.info('📋 Configuration:');
    logger.info(`   - Rewards Controller: ${AAVE_REWARDS_CONTROLLER}`);
    logger.info(`   - Asset: ${A_USDC_SEPOLIA}`);
    logger.info(`   - Recipient: ${recipientAddress}`);
    logger.info('📋 Triggers:');
    logger.info('   - Cron: Daily at midnight (0 0 * * *)');
    logger.info('   - Onchain: When rewards > 0');
    logger.info('📋 Steps:');
    logger.info('   1. Claim rewards on behalf of user');
    logger.info('   2. Transfer to recipient address');
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

/**
 * Alternative workflow using claimAllRewardsOnBehalf for multiple assets
 */
async function createAaveClaimAllWorkflow(
    ownerAccount: Signer,
    executorAccountAddress: `0x${string}`,
    storage: IpfsStorage,
    recipientAddress: `0x${string}`
) {
    logger.info('💰 Creating Aave Claim All Workflow...\n');

    const workflow = WorkflowBuilder.create(addressToEmptyAccount(ownerAccount.address!))
        .addCronTrigger("0 0 * * *") // Daily at midnight
        .setValidAfter(Date.now() - 60 * 60 * 1000)
        .setValidUntil(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .setInterval(86400)

        .addJob(
            JobBuilder.create("aave-claim-all-job")
                .setChainId(ChainId.SEPOLIA)

                // Step 1: Claim all rewards from all assets
                .addStep({
                    target: AAVE_REWARDS_CONTROLLER,
                    abi: "claimAllRewardsOnBehalf(address[] assets, address user, address to) returns (address[] rewardsList, uint256[] claimedAmounts)",
                    args: [
                        [A_USDC_SEPOLIA], // Can add more aTokens here
                        ownerAccount.address!,
                        recipientAddress // Direct claim to recipient
                    ],
                    value: BigInt(0)
                })

                .build()
        )
        .build();

    logger.info('✅ Workflow structure created (Claim All variant)');
    logger.info('📋 Steps:');
    logger.info('   1. Claim all rewards directly to recipient');
    logger.info('');

    const response = await submitWorkflow(
        workflow,
        executorAccountAddress,
        storage,
        ownerAccount,
        false,
        IPFS_SERVICE_URL
    );

    return response;
}

async function main() {
    try {
        if (!OWNER_PRIVATE_KEY || !EXECUTOR_PRIVATE_KEY || !WORKFLOW_CONTRACT_ADDRESS) {
            throw new Error('Missing required environment variables. Please check your .env file.');
        }

        logger.info("🚀 Aave Umbrella Claim Workflow Example\n");
        logger.info("════════════════════════════════════════════════════════════\n");

        // Initialize accounts
        const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
        const executorAccount = privateKeyToAccount(EXECUTOR_PRIVATE_KEY);
        const executorAddress = executorAccount.address;

        logger.info(`👤 Owner: ${ownerAccount.address}`);
        logger.info(`⚙️  Executor: ${executorAddress}`);
        logger.info(`📬 Recipient: ${RECIPIENT_ADDRESS}\n`);

        // Initialize IPFS storage
        const storage = new IpfsStorage(IPFS_SERVICE_URL);

        // Create workflow (choose one approach)
        logger.info("📝 Creating workflow variant 1: Claim + Transfer\n");
        const response1 = await createAaveClaimWorkflow(
            ownerAccount,
            executorAddress,
            storage,
            RECIPIENT_ADDRESS
        );

        logger.info("════════════════════════════════════════════════════════════\n");
        logger.info("✅ Aave Claim Workflow Created Successfully!\n");
        logger.info("📋 Workflow 1 - Claim + Transfer:");
        logger.info(`   IPFS Hash: ${response1.ipfsHash}`);
        logger.info(`   Transaction Hashes: ${response1.userOpHashes.map(op => op.receipt?.transactionHash).filter(Boolean).join(', ')}`);
        logger.info('');

        // Optionally create second variant
        logger.info("📝 Creating workflow variant 2: Claim All Direct\n");
        const response2 = await createAaveClaimAllWorkflow(
            ownerAccount,
            executorAddress,
            storage,
            RECIPIENT_ADDRESS
        );

        logger.info("📋 Workflow 2 - Claim All Direct:");
        logger.info(`   IPFS Hash: ${response2.ipfsHash}`);
        logger.info(`   Transaction Hashes: ${response2.userOpHashes.map(op => op.receipt?.transactionHash).filter(Boolean).join(', ')}`);
        logger.info('');

        logger.info("🎯 What happens next:");
        logger.info("   1. Workflows run daily automatically");
        logger.info("   2. Checks for claimable Aave rewards");
        logger.info("   3. Claims and transfers to recipient");
        logger.info("   4. No gas fees required!");
        logger.info('');

    } catch (error) {
        logger.error("❌ Workflow creation failed:", error);
        process.exit(1);
    }
}

main();
