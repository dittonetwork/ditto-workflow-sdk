import { baseSepolia, mainnet, sepolia } from 'viem/chains'
import { ChainId } from './constants'

function env(key: string, fallback: string): string {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] as string
    }
    return fallback
}

type ChainConfig = { chainId: ChainId; chain: any; rpcUrl: string }

export interface ChainConfigProvider {
    getChainConfig(): Record<number, ChainConfig>
}

export class EnvChainConfigProvider implements ChainConfigProvider {
    getChainConfig(): Record<number, ChainConfig> {
        return {
            [ChainId.SEPOLIA]: { chainId: ChainId.SEPOLIA, chain: sepolia as any, rpcUrl: env('DEFAULT_RPC_URL_SEPOLIA', 'https://rpc.ankr.com/eth_sepolia') },
            [ChainId.ETHEREUM]: { chainId: ChainId.ETHEREUM, chain: mainnet, rpcUrl: env('DEFAULT_RPC_URL_MAINNET', 'https://rpc.ankr.com/eth') },
            [ChainId.BASE_SEPOLIA]: { chainId: ChainId.BASE_SEPOLIA, chain: baseSepolia as any, rpcUrl: env('DEFAULT_RPC_URL_BASE_SEPOLIA', 'https://sepolia.base.org') },
        }
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