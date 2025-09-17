import { parseAbiItem, AbiFunction } from 'viem'
import { baseSepolia, sepolia, base, mainnet, arbitrum, polygon, optimism } from 'viem/chains'

export enum ChainId {
    SEPOLIA = 11155111,
    BASE = 8453,
    ARBITRUM = 42161,
    POLYGON = 137,
    OPTIMISM = 10,
    MAINNET = 1,
}

export const CHAINS = [sepolia, base, mainnet, arbitrum, polygon, optimism]

export const DittoWFRegistryAbi = [
    parseAbiItem('function markRun(string)') as AbiFunction,
    parseAbiItem('function markRunWithMetadata(string, string, uint256, bool)') as AbiFunction,
    parseAbiItem('function createWF(string) returns (bytes)') as AbiFunction,
    parseAbiItem('function cancelWF(string)') as AbiFunction,
]

export const entryPointVersion = "0.7";
