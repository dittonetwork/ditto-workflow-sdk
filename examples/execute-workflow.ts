import {
    executeFromIpfs,
} from '../src';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex } from 'viem';
import * as dotenv from 'dotenv';
import { IpfsStorage } from '../src/storage/IpfsStorage';
import { Signer } from '@zerodev/sdk/types';
import { ConsoleLogger } from '../src';

dotenv.config({ path: '.env' });

const IPFS_SERVICE_URL = process.env.IPFS_SERVICE_URL || 'https://api.ditto.network/ipfs';
const EXECUTOR_PRIVATE_KEY = process.env.EXECUTOR_PRIVATE_KEY as Hex;

const logger = new ConsoleLogger();

async function simulateWorkflow(
    ipfsHash: string,
    storage: IpfsStorage,
    executorAccount: Signer
) {
    logger.info(`🚀 Executing workflow from IPFS: ${ipfsHash}`);

    const result = await executeFromIpfs(
        ipfsHash,
        storage,
        executorAccount,
        BigInt(0),
        false, // Set to true for dry run simulation
        false
    );

    return result;
}

async function main() {
    try {
        // Get IPFS hash from command line argument or use default
        const ipfsHash = process.argv[2] || 'QmbRtCvtT3yXf8a5Bqs3NgSi2WLWJjUWBSYg2xCnKuNqXq';

        if (!EXECUTOR_PRIVATE_KEY) {
            throw new Error('Missing EXECUTOR_PRIVATE_KEY in environment variables. Please check your .env file.');
        }

        logger.info("🚀 Starting workflow execution...");
        logger.info("📋 IPFS Hash:", ipfsHash);

        // Initialize executor account
        const executorAccount = privateKeyToAccount(EXECUTOR_PRIVATE_KEY);
        logger.info("📋 Executor Address:", executorAccount.address);

        // Initialize IPFS storage
        const storage = new IpfsStorage(IPFS_SERVICE_URL);

        // Execute workflow
        const result = await simulateWorkflow(ipfsHash, storage, executorAccount);

        logger.info("✅ Workflow execution completed!");
        logger.info("📋 Results:", result.results);

        if (result.results && result.results.length > 0) {
            result.results.forEach((jobResult, index) => {
                logger.info(`📋 Job ${index + 1} Result:`, {
                    chainId: jobResult.chainId,
                    success: jobResult.success,
                    result: jobResult.result,
                    gas: jobResult.gas,
                    error: jobResult.error
                });
            });
        }

        console.log("\n🌐 View workflow status at:");
        console.log(`${process.env.VITE_STATUS_DASHBOARD_URI}/workflow/status/${ipfsHash}`);

    } catch (error) {
        logger.error("❌ Workflow execution failed:", error);
        process.exit(1);
    }
}

main(); 