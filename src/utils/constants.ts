import { parseAbiItem, AbiFunction } from 'viem';
import { baseSepolia, mainnet, sepolia } from 'viem/chains';

// Common chain IDs
export enum ChainId {
  ETHEREUM = 1,
  GOERLI = 5,
  SEPOLIA = 11155111,
  OPTIMISM = 10,
  OPTIMISM_GOERLI = 420,
  ARBITRUM = 42161,
  ARBITRUM_GOERLI = 421613,
  POLYGON = 137,
  MUMBAI = 80001,
  BASE = 8453,
  BASE_GOERLI = 84531,
  BASE_SEPOLIA = 84532,
}


export function getChainConfig(): Record<number, {
  chainId: ChainId;
  chain: any;
  rpcUrl: string;
}> {
  return {
    [ChainId.SEPOLIA]: {
      chainId: ChainId.SEPOLIA,
      chain: sepolia as any,
      rpcUrl: process.env.DEFAULT_RPC_URL_SEPOLIA as string,
    },
    [ChainId.ETHEREUM]: {
      chainId: ChainId.ETHEREUM,
      chain: mainnet,
      rpcUrl: process.env.DEFAULT_RPC_URL_MAINNET as string,
    },
    [ChainId.BASE_SEPOLIA]: {
      chainId: ChainId.BASE_SEPOLIA,
      chain: baseSepolia as any,
      rpcUrl: process.env.DEFAULT_RPC_URL_BASE_SEPOLIA as string,
    },
  };
}

export const workflowRegistryAbi = [
  {
    inputs: [
      {
        name: 'ipfsHash',
        type: 'string',
      },
    ],
    name: 'createWF',
    outputs: [
      {
        name: 'userOpHash',
        type: 'bytes',
      },
    ],
    type: 'function',
  }
] as const;


export const DittoWFRegistryAbi = [parseAbiItem(`function markRunWithMetadata(string,string,uint256)`) as AbiFunction];

export const DittoWFRegistryAddress = "0x5CE5E78588F4dC8556E2c607134e8b76567AECE6" as `0x${string}`;