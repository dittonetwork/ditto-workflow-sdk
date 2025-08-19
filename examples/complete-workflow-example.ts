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
import { sepolia } from 'viem/chains';
import { Signer } from '@zerodev/sdk/types';
import { addressToEmptyAccount } from '@zerodev/sdk';
import { PinoLogger } from '../src';
// import { IpfsServiceUrl } from '../src/utils/constants';

dotenv.config({ path: '.env' });

const WORKFLOW_CONTRACT_ADDRESS = process.env.WORKFLOW_CONTRACT_ADDRESS as `0x${string}`;
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
const EXECUTOR_PRIVATE_KEY = process.env.EXECUTOR_PRIVATE_KEY as Hex;
const IPFS_SERVICE_URL = process.env.IPFS_SERVICE_URL as string;

const logger = new PinoLogger();

async function createAndSubmitWorkflow(
  ownerAccount: Signer,
  executorAccountAddress: `0x${string}`,
  storage: IpfsStorage
) {
  const workflow = WorkflowBuilder.create(addressToEmptyAccount(ownerAccount.address!))
    // .addOnchainTrigger({
    //   target: "0x23D20B93a238Da60486b80E03aFCF4B8aa3c7af6",
    //   abi: 'returnUint(uint256 value)',
    //   args: [12],
    //   chainId: ChainId.SEPOLIA,
    // })
    .addCronTrigger("* * * * *")
    .setCount(3)
    .setValidAfter(Date.now() - 1000 * 60 * 60 * 24 * 30)
    .setValidUntil(Date.now() + 1000 * 60 * 60 * 24 * 30)
    .addJob(
      JobBuilder.create("job-1754655494259")
        .setChainId(sepolia.id)
        .addStep({
          target: "0xa77c5c0d16fb00bb9cbfce13b4c7802e265d3f62",
          abi: "",
          args: [],
          value: BigInt(1000000000000)
        })
        .addStep({
          target: "0xa77c5c0d16fb00bb9cbfce13b4c7802e265d3f62",
          abi: "",
          args: [],
          value: BigInt(2000000000000)
        })
        .addStep({
          target: "0x23d20b93a238da60486b80e03afcf4b8aa3c7af6",
          abi: "returnBool(bool value)",
          args: [false],
          value: BigInt(0)
        })
        .addStep({
          target: "0x23d20b93a238da60486b80e03afcf4b8aa3c7af6",
          abi: "returnBool(bool value)",
          args: [true],
          value: BigInt(0)
        })
        .build()
    )
    .build();

  const response = await submitWorkflow(
    workflow,
    executorAccountAddress,
    storage,
    ownerAccount,
    false,
    process.env.ZERODEV_API_KEY as string,
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
    false,
    process.env.ZERODEV_API_KEY as string,
    false,
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
    executorAccount,
  );

  logger.info("Results: ", simulateResult.results);
}


async function main() {
  try {
    await completeWorkflowExample();
  } catch (error) {
    console.log(error);
    logger.error("Example failed", error);
    process.exit(1);
  }
}

main();