import { parseAbiItem, AbiFunction } from 'viem'
import { baseSepolia, sepolia, base } from 'viem/chains'

export enum ChainId {
    SEPOLIA = 11155111,
    BASE_SEPOLIA = 84532,
    BASE = 8453,
}

export const CHAINS = [sepolia, baseSepolia, base]

export const DittoWFRegistryAbi = [
    parseAbiItem('function markRun(string)') as AbiFunction,
    parseAbiItem('function createWF(string) returns (bytes)') as AbiFunction,
]

export const entryPointVersion = "0.7";

export const DittoWFRegistryAddress = "0x7D48195F9b04ef4001B23b012411cb2E20ca86A8" as `0x${string}`;