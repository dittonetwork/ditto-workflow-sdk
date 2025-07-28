import { baseSepolia, mainnet, sepolia } from 'viem/chains'
import { ChainId, CHAINS } from './constants'

type ChainConfig = { chainId: ChainId; chain: any; rpcUrl: string }

export interface ChainConfigProvider {
    getChainConfig(): Record<number, ChainConfig>
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
}

export class MemoryChainConfigProvider implements ChainConfigProvider {
    private overrides: Record<number, string> = {}
    setRpcUrl(chainId: number, url: string) {
        this.overrides[chainId] = url
    }
    getChainConfig(): Record<number, ChainConfig> {
        const base = new EnvChainConfigProvider().getChainConfig()
        Object.keys(this.overrides).forEach(k => {
            const id = Number(k)
            if (base[id]) base[id].rpcUrl = this.overrides[id]
        })
        return base
    }
}

let provider: ChainConfigProvider = new EnvChainConfigProvider()

export function setChainConfigProvider(p: ChainConfigProvider) {
    provider = p
}

export function getChainConfig(): Record<number, ChainConfig> {
    return provider.getChainConfig()
}

// Re-export enum for consumers expecting it from this module
export { ChainId } from './constants' 