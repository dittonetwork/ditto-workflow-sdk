import { ChainId, CHAINS } from './constants'

type ChainConfig = { chainId: ChainId; chain: any; rpcUrl: string }

export class StatelessChainConfigProvider {
    static getChainConfig(ipfsServiceUrl: string): Record<number, ChainConfig> {
        if (!ipfsServiceUrl) {
            throw new Error('Ipfs Service URL is not set')
        }
        var config: Record<number, ChainConfig> = {}
        for (const chain of CHAINS) {
            config[chain.id] = {
                chainId: chain.id,
                chain: chain as any,
                rpcUrl: `${ipfsServiceUrl}/bundler/${chain.id}`
            }
        }
        return config
    }
    static getDittoWFRegistryAddress(isProd: boolean): `0x${string}` {
        if (isProd) {
            return '0x7D48195F9b04ef4001B23b012411cb2E20ca86A8' as `0x${string}`
        }
        return '0x580F57c1668d9272aE54168f630cc84b10ec65F7' as `0x${string}`
    }
}

export function getChainConfig(ipfsServiceUrl: string): Record<number, ChainConfig> {
    return StatelessChainConfigProvider.getChainConfig(ipfsServiceUrl)
}

export function getDittoWFRegistryAddress(isProd: boolean): `0x${string}` {
    return StatelessChainConfigProvider.getDittoWFRegistryAddress(isProd)
}

// Re-export enum for consumers expecting it from this module
export { ChainId } from './constants' 