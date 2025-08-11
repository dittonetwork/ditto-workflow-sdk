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
    .addCronTrigger("* * * * *")
    .setCount(3)
    .setValidAfter(Date.now() - 1000 * 60 * 60 * 24 * 30)
    .setValidUntil(Date.now() + 1000 * 60 * 60 * 24 * 30)
    .addJob(
      JobBuilder.create("job-1754655494259")
        .setChainId(sepolia.id)
        .addStep({
          target: "0xA77c5C0D16FB00bB9cbfCe13B4C7802E265d3f62",
          abi: "",
          args: [],
          value: BigInt(50000000000000000)
        })
        .build()
    )
    .build();

  console.log(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const response = await submitWorkflow(
    workflow,
    executorAccountAddress,
    storage,
    ownerAccount,
    false,
    process.env.ZERODEV_API_KEY as string,
  );
  // console.log("response", response);

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
    true,
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

  // const response = await createAndSubmitWorkflow(ownerAccount, executorAddress, storage);

  // logger.info("Workflow uploaded", response.ipfsHash);

  logger.info("Simulating workflow");
  const simulateResult = await simulateWorkflow(
    "QmTo2tR6cLSTBUriVVBGNHW6EzafSjjnqgrVyonDidk5TA",
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