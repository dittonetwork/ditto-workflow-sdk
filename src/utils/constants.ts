import { parseAbiItem, AbiFunction } from 'viem'
import { baseSepolia, sepolia } from 'viem/chains'

export enum ChainId {
    SEPOLIA = 11155111,
    BASE_SEPOLIA = 84532,
    BASE = 8453,
}

export const CHAINS = [sepolia, baseSepolia, base]
export const workflowRegistryAbi = [
    {
        inputs: [{ name: 'ipfsHash', type: 'string' }],
        name: 'createWF',
        outputs: [{ name: 'userOpHash', type: 'bytes' }],
        type: 'function',
    },
] as const

export const DittoWFRegistryAbi = [
    parseAbiItem('function markRun(string)') as AbiFunction,
]

export const DittoWFRegistryAddress = '0x5CE5E78588F4dC8556E2c607134e8b76567AECE6' as `0x${string}`

export const entryPointVersion = "0.7";