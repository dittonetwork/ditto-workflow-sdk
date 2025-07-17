import { Address, createPublicClient, http, encodeFunctionData } from 'viem';
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
} from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { UserOperationReceipt } from 'viem/account-abstraction';
import { getChainConfig } from '../utils/chainConfigProvider';
import { workflowRegistryAbi, entryPointVersion } from '../utils/constants';
import { Signer } from "@zerodev/sdk/types";

export class WorkflowContract {
  private readonly contractAddress: Address;

  constructor(contractAddress: Address) {
    this.contractAddress = contractAddress;
  }

  get address(): Address {
    return this.contractAddress;
  }

  async getNonce(user: Address, chainId: number): Promise<bigint> {
    const chainConfig = getChainConfig();
    const chain = chainConfig[chainId]?.chain;
    const rpcUrl = chainConfig[chainId as keyof typeof chainConfig]?.rpcUrl;
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
      chain: chain,
    });
    
    const nonce = await publicClient.readContract({
        address: this.contractAddress,
        abi: workflowRegistryAbi,
        functionName: 'userNonce',
        args: [user]
    });

    return nonce as bigint;
  }

  async createWorkflow(ipfsHash: string, ownerAccount: Signer, chainId: number): Promise<UserOperationReceipt> {
    const chainConfig = getChainConfig();
    const chain = chainConfig[chainId]?.chain;
    const rpcUrl = chainConfig[chainId as keyof typeof chainConfig]?.rpcUrl;
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
      chain: chain,
    });

    const entryPoint = getEntryPoint(entryPointVersion);

    const ownerValidator = await signerToEcdsaValidator(publicClient, {
      entryPoint,
      signer: ownerAccount,
      kernelVersion: KERNEL_V3_3,
    });
    const kernelAccount = await createKernelAccount(publicClient, {
      plugins: {
        sudo: ownerValidator,
      },
      entryPoint,
      kernelVersion: KERNEL_V3_3,
    });

    const kernelPaymaster = createZeroDevPaymasterClient({
      chain: chain,
      transport: http(rpcUrl),
    });

    const kernelClient = createKernelAccountClient({
      account: kernelAccount,
      chain: chain,
      bundlerTransport: http(rpcUrl),
      paymaster: {
        getPaymasterData(userOperation) {
          return kernelPaymaster.sponsorUserOperation({ userOperation });
        },
      },
    });

    const createWFCalldata = encodeFunctionData({
      abi: workflowRegistryAbi,
      functionName: "createWF",
      args: [ipfsHash],
    });

    const userOpHash = await kernelClient.sendUserOperation({
      callData: await kernelAccount.encodeCalls([
        {
          to: this.contractAddress,
          value: BigInt(0),
          data: createWFCalldata,
        },
      ]),
    });

    const result = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });

    return result;
  }
} 