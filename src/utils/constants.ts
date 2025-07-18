import { parseAbiItem, AbiFunction } from 'viem'

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