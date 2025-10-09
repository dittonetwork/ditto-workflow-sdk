import { Address, createPublicClient, http, encodeFunctionData } from 'viem';
import {
  createKernelAccount,
} from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { signerToSessionKeyValidator } from "@zerodev/session-key";
import { getEntryPoint, KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { createBundlerClient, createPaymasterClient, UserOperationReceipt } from 'viem/account-abstraction';
import { getChainConfig } from '../utils/chainConfigProvider';
import { DittoWFRegistryAbi, entryPointVersion } from '../utils/constants';
import { Signer } from "@zerodev/sdk/types";
import { authHttpConfig } from '../utils/httpTransport';
import { toEmptyECDSASigner } from '@zerodev/permissions/signers';
import { buildSudoPolicy } from '../core/builders/PermissionBuilder';
import { serializePermissionAccount, toPermissionValidator } from "@zerodev/permissions";


export class WorkflowContract {
  private readonly contractAddress: Address;

  constructor(contractAddress: Address) {
    this.contractAddress = contractAddress;
  }

  get address(): Address {
    return this.contractAddress;
  }

  async createWorkflow(
    ipfsHash: string,
    ownerAccount: Signer,
    chainId: number,
    ipfsServiceUrl: string,
    usePaymaster: boolean = false,
    accessToken?: string,
  ): Promise<UserOperationReceipt> {
    const chainConfig = getChainConfig(ipfsServiceUrl);
    const chain = chainConfig[chainId]?.chain;
    const rpcUrl = chainConfig[chainId as keyof typeof chainConfig]?.rpcUrl;
    const publicClient = createPublicClient({
      transport: http(rpcUrl, authHttpConfig(accessToken)),
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

    const kernelPaymaster = createPaymasterClient({
      transport: http(rpcUrl, authHttpConfig(accessToken)),
    });
    // const maxFeePerGas = await publicClient.estimateFeesPerGas();
    const kernelClient = createBundlerClient({
      account: kernelAccount,
      chain: chain,
      transport: http(rpcUrl, authHttpConfig(accessToken)),
      paymaster: usePaymaster ? kernelPaymaster : undefined,
      client: publicClient,
      // userOperation: {
      //   async estimateFeesPerGas({ account, bundlerClient, userOperation }) {
      //     // Estimate fees per gas for the User Operation. 
      //     return {
      //       maxFeePerGas: BigInt(maxFeePerGas.maxFeePerGas),
      //       maxPriorityFeePerGas: BigInt(maxFeePerGas.maxPriorityFeePerGas),
      //     }
      //   }
      // }
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

  async cancelWorkflow(
    ipfsHash: string,
    ownerAccount: Signer,
    chainId: number,
    ipfsServiceUrl: string,
    usePaymaster: boolean = false,
    accessToken?: string,
  ): Promise<UserOperationReceipt> {
    const chainConfig = getChainConfig(ipfsServiceUrl);
    const chain = chainConfig[chainId]?.chain;
    const rpcUrl = chainConfig[chainId as keyof typeof chainConfig]?.rpcUrl;
    const publicClient = createPublicClient({
      transport: http(rpcUrl, authHttpConfig(accessToken)),
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

    const kernelPaymaster = createPaymasterClient({
      transport: http(rpcUrl, authHttpConfig(accessToken)),
    });
    const kernelClient = createBundlerClient({
      account: kernelAccount,
      chain: chain,
      transport: http(rpcUrl, authHttpConfig(accessToken)),
      paymaster: usePaymaster ? kernelPaymaster : undefined,
      client: publicClient,
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
