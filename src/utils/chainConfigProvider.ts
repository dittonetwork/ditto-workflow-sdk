import { baseSepolia, mainnet, sepolia } from 'viem/chains'
import { ChainId, CHAINS } from './constants'

type ChainConfig = { chainId: ChainId; chain: any; rpcUrl: string }

export interface ChainConfigProvider {
    getChainConfig(): Record<number, ChainConfig>
    getDittoWFRegistryAddress(): `0x${string}`
}

export class EnvChainConfigProvider implements ChainConfigProvider {
    getChainConfig(): Record<number, ChainConfig> {
        const zerodevApiKey = process.env.ZERODEV_API_KEY
        if (!zerodevApiKey) {
            throw new Error('ZERODEV_API_KEY is not set')
        }
        var config: Record<number, ChainConfig> = {}
        for (const chain of CHAINS) {
            config[chain.id] = {
                chainId: chain.id,
                chain: chain as any,
                rpcUrl: `https://rpc.zerodev.app/api/v3/${zerodevApiKey}/chain/${chain.id}`
            }
        }
        return config
    }
    getDittoWFRegistryAddress(): `0x${string}` {
        if (!process.env.WORKFLOW_CONTRACT_ADDRESS) {
            throw new Error('DITTO_WF_REGISTRY_ADDRESS is not set')
        }
        return process.env.WORKFLOW_CONTRACT_ADDRESS as `0x${string}`
    }
}

export class MemoryChainConfigProvider implements ChainConfigProvider {
    private config: Record<number, ChainConfig> = {}
    private registryAddress: `0x${string}` = process.env.WORKFLOW_CONTRACT_ADDRESS as `0x${string}`
    setChainConfig(chainId: number, chain: any, rpcUrl: string) {
        this.config[chainId] = { chainId, chain, rpcUrl }
    }

    setRpcUrl(chainId: number, url: string) {
        if (this.config[chainId]) {
            this.config[chainId].rpcUrl = url
        }
    }

    setDittoWFRegistryAddress(address: `0x${string}`) {
        this.registryAddress = address
    }

    removeChain(chainId: number) {
        delete this.config[chainId]
    }

    getChainConfig(): Record<number, ChainConfig> {
        return { ...this.config }
    }

    getDittoWFRegistryAddress(): `0x${string}` {
        return this.registryAddress
    }
}

let provider: ChainConfigProvider = new EnvChainConfigProvider()

export function setChainConfigProvider(p: ChainConfigProvider) {
    provider = p
}

export function getChainConfig(): Record<number, ChainConfig> {
    return provider.getChainConfig()
}

export function getDittoWFRegistryAddress(): `0x${string}` {
    return provider.getDittoWFRegistryAddress()
}

// Re-export enum for consumers expecting it from this module
export { ChainId } from './constants' 