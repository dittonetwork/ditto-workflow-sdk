import { parseAbiItem, AbiFunction } from 'viem'
import { baseSepolia, holesky, sepolia, base, mainnet, arbitrum, polygon, optimism } from 'viem/chains'

export enum ChainId {
    SEPOLIA = 11155111,
    BASE_SEPOLIA = 84532,
    HOLESKY = 17000,
    BASE = 8453,
    ARBITRUM = 42161,
    POLYGON = 137,
    OPTIMISM = 10,
    MAINNET = 1,
}

export const CHAINS = [base, mainnet, arbitrum, polygon, optimism]
export const TEST_CHAINS = [sepolia, baseSepolia, holesky]

export const DittoWFRegistryAbi = [
    parseAbiItem('function markRun(string)') as AbiFunction,
    parseAbiItem('function createWF(string) returns (bytes)') as AbiFunction,
    parseAbiItem('function cancelWF(string)') as AbiFunction,
]

export const entryPointVersion = "0.7";
