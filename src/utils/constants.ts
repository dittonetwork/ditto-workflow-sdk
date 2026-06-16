import { parseAbiItem, AbiFunction } from 'viem'
import { baseSepolia, sepolia, base, mainnet, arbitrum, polygon } from 'viem/chains'

export enum ChainId {
    SEPOLIA = 11155111,
    BASE_SEPOLIA = 84532,
    BASE = 8453,
    ARBITRUM = 42161,
    POLYGON = 137,
    OPTIMISM = 10,
    MAINNET = 1,
}

// NOTE: Optimism is intentionally excluded — the Ditto AVS stack (Attestation Center,
// hook, DittoPolicy) is not deployed there. Add it back only once the policy exists on-chain.
export const PROD_CHAINS = [base, mainnet, arbitrum, polygon]
export const TEST_CHAINS = [sepolia, baseSepolia]

export const DittoWFRegistryAbi = [
    parseAbiItem('function markRun(string)') as AbiFunction,
    parseAbiItem('function createWF(string) returns (bytes)') as AbiFunction,
    parseAbiItem('function cancelWF(string)') as AbiFunction,
]

export const entryPointVersion = "0.7";
