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
import { DittoWFRegistryAbi, entryPointVersion } from '../utils/constants';
import { Signer } from "@zerodev/sdk/types";

export class WorkflowContract {
  private readonly contractAddress: Address;

  constructor(contractAddress: Address) {
    this.contractAddress = contractAddress;
  }

  get address(): Address {
    return this.contractAddress;
  }

  async createWorkflow(ipfsHash: string, ownerAccount: Signer, chainId: number, zerodevApiKey: string, usePaymaster: boolean = false): Promise<UserOperationReceipt> {
    const chainConfig = getChainConfig(zerodevApiKey);
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
      paymaster: usePaymaster ? {
        getPaymasterData(userOperation) {
          return kernelPaymaster.sponsorUserOperation({ userOperation });
        }
      } : undefined,
    });

    const createWFCalldata = encodeFunctionData({
      abi: DittoWFRegistryAbi,
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

  async cancelWorkflow(ipfsHash: string, ownerAccount: Signer, chainId: number, zerodevApiKey: string, usePaymaster: boolean = false): Promise<UserOperationReceipt> {
    const chainConfig = getChainConfig(zerodevApiKey);
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
      paymaster: usePaymaster ? {
        getPaymasterData(userOperation) {
          return kernelPaymaster.sponsorUserOperation({ userOperation });
        }
      } : undefined,
    });

    const cancelWFCalldata = encodeFunctionData({
      abi: DittoWFRegistryAbi,
      functionName: "cancelWF",
      args: [ipfsHash],
    });

    const userOpHash = await kernelClient.sendUserOperation({
      callData: await kernelAccount.encodeCalls([
        {
          to: this.contractAddress,
          value: BigInt(0),
          data: cancelWFCalldata,
        },
      ]),
    });

    const result = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });

    return result;
  }
} 