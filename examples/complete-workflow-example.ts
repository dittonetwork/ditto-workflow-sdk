import {
  WorkflowBuilder,
  JobBuilder,
  ChainId,
  executeFromIpfs,
  submitWorkflow,
} from '../src';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex } from 'viem';
import * as dotenv from 'dotenv';
import { IpfsStorage } from '../src/storage/IpfsStorage';
import { baseSepolia, sepolia } from 'viem/chains';
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
    .addEventTrigger({
      signature: "Transfer(address indexed from, address indexed to, uint256 value)",
      contractAddress: "0x34bE7f35132E97915633BC1fc020364EA5134863" as `0x${string}`,
      chainId: ChainId.SEPOLIA,
      filter: {
        from: "0x0000000000000000000000000000000000000000", // Mint events
        to: ownerAccount.address // Mint to owner
      }
    })
    .addCronTrigger("0 */6 * * *")
    .setCount(3)
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
    ).addJob(
      JobBuilder.create("mint-nft-job-base-sepolia")
        .setChainId(baseSepolia.id)
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

async function simulateWorkflow(
  ipfsHash: string,
  storage: IpfsStorage,
  executorAccount: Signer
) {
  const result = await executeFromIpfs(
    ipfsHash,
    storage,
    executorAccount,
    BigInt(0),
    false
  );

  return result;
}
async function completeWorkflowExample() {
  if (!OWNER_PRIVATE_KEY || !EXECUTOR_PRIVATE_KEY || !WORKFLOW_CONTRACT_ADDRESS) {
    throw new Error('Missing required environment variables. Please check your .env file.');
  }

  // initialize accounts
  const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
  const executorAccount = privateKeyToAccount(EXECUTOR_PRIVATE_KEY);
  const executorAddress = executorAccount.address;

  //ipfs storage
  const storage = new IpfsStorage(IPFS_SERVICE_URL);

  const response = await createAndSubmitWorkflow(ownerAccount, executorAddress, storage);

  logger.info("Workflow uploaded", response.ipfsHash);

  logger.info("Simulating workflow");
  const simulateResult = await simulateWorkflow(
    response.ipfsHash,
    storage,
    executorAccount
  );

  logger.info("Gas estimate", simulateResult.results);
}


async function main() {
  try {
    await completeWorkflowExample();
  } catch (error) {
    logger.error("Example failed", error);
    process.exit(1);
  }
}

main();