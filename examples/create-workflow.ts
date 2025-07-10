import {
    WorkflowBuilder,
    JobBuilder,
    ChainId,
    submitWorkflow,
} from '../src';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex } from 'viem';
import * as dotenv from 'dotenv';
import { IpfsStorage } from '../src/storage/IpfsStorage';
import { sepolia } from 'viem/chains';
import { Signer } from '@zerodev/sdk/types';
import { addressToEmptyAccount } from '@zerodev/sdk';
import { ConsoleLogger } from '../src';

dotenv.config({ path: '.env' });

const IPFS_SERVICE_URL = process.env.IPFS_SERVICE_URL || 'https://api.ditto.network/ipfs';
const WORKFLOW_CONTRACT_ADDRESS = process.env.WORKFLOW_CONTRACT_ADDRESS as `0x${string}`;
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
const EXECUTOR_PRIVATE_KEY = process.env.EXECUTOR_PRIVATE_KEY as Hex;

const logger = new ConsoleLogger();

async function createAndSubmitWorkflow(
    ownerAccount: Signer,
    executorAccountAddress: `0x${string}`,
    storage: IpfsStorage
) {
    const workflow = WorkflowBuilder.create(addressToEmptyAccount(ownerAccount.address!))
        .addCronTrigger("*/2 * * * *")
        .setCount(3)
        .setValidAfter(Date.now() - 2 * 60 * 60 * 1000)
        .setValidUntil(Date.now() + 2 * 60 * 60 * 1000)
        .addJob(
            JobBuilder.create("mint-nft-job-sepolia")
                .setChainId(sepolia.id)
                .addStep({
                    target: "0x34bE7f35132E97915633BC1fc020364EA5134863",
                    abi: "mint(address)",
                    args: [ownerAccount.address!],
                    value: BigInt(0)
                })
                .addStep({
                    target: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
                    abi: "latestRoundData()",
                    args: [],
                    value: BigInt(0)
                })
                .build()
        )
        .build();

    const response = await submitWorkflow(
        workflow,
        executorAccountAddress,
        storage,
        ownerAccount
    );

    return response;
}

async function main() {
    try {
        if (!OWNER_PRIVATE_KEY || !EXECUTOR_PRIVATE_KEY || !WORKFLOW_CONTRACT_ADDRESS) {
            throw new Error('Missing required environment variables. Please check your .env file.');
        }

        logger.info("🚀 Creating and submitting workflow...");

        // Initialize accounts
        const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
        const executorAccount = privateKeyToAccount(EXECUTOR_PRIVATE_KEY);
        const executorAddress = executorAccount.address;

        // Initialize IPFS storage
        const storage = new IpfsStorage(IPFS_SERVICE_URL);

        // Create and submit workflow
        const response = await createAndSubmitWorkflow(ownerAccount, executorAddress, storage);

        logger.info("✅ Workflow created successfully!");
        logger.info("📋 IPFS Hash:", response.ipfsHash);
        logger.info("📋 Transaction Hashes:", response.userOpHashes.map(op => op.receipt?.transactionHash).filter(Boolean));

        console.log("\n🌐 View your workflow status at:");
        console.log(`http://localhost:3007/workflow/status/${response.ipfsHash}`);

    } catch (error) {
        logger.error("❌ Workflow creation failed:", error);
        process.exit(1);
    }
}

main(); 