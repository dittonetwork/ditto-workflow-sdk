import { ChainId, PROD_CHAINS, TEST_CHAINS } from './constants'
import { Chain } from 'viem'
type ChainConfig = { chainId: ChainId; chain: any; rpcUrl: string }

export class StatelessChainConfigProvider {
    static getChainConfig(ipfsServiceUrl: string): Record<number, ChainConfig> {
        if (!ipfsServiceUrl) {
            throw new Error('Ipfs Service URL is not set')
        }
        var config: Record<number, ChainConfig> = {}
        for (const chain of [...PROD_CHAINS, ...TEST_CHAINS]) {
            config[chain.id] = {
                chainId: chain.id,
                chain: chain as any,
                rpcUrl: `${ipfsServiceUrl}/bundler/${chain.id}`
            }
        }
        return config
    }
    static getDittoWFRegistryAddress(isProd: boolean, chainId?: number): `0x${string}` {
        if (isProd) {
            // Prod: same CREATE2 address on mainnet, base, arbitrum, polygon.
            return '0x7D48195F9b04ef4001B23b012411cb2E20ca86A8' as `0x${string}`
        }
        // Stage: Sepolia has the original deploy; Base Sepolia is a fresh non-CREATE2 deploy.
        if (chainId === 84532) {
            return '0x1483314b19e2b95d4b5edf623400fc7974f212b1' as `0x${string}`
        }
        return '0x2AaDd0197b90DF5329AEa223971457Bdb0E4f5ea' as `0x${string}`
    }

    static getDittoExecutorAddress(): `0x${string}` {
        return '0xF177179963aA0EDE80Be4396d04d970171CF6a36' as `0x${string}`
    }

    static getDittoPolicyAddress(isProd: boolean, chainId?: number): `0x${string}` {
        if (isProd) {
            // Prod DittoPolicy (UUPS proxy, atomic-init v4) at the same deterministic address
            // across Ethereum, Polygon, Base, and Arbitrum. Replaces 0x7BC0c021... whose Arbitrum
            // proxy was hijacked via an initialize-snipe on the old non-atomic deploy.
            return '0x5E85C2ACd361F924948311c69BfC69228D7761FF' as `0x${string}`
        }
        // Stage: Base Sepolia has a fresh v3 deploy (plain CREATE, atomic init).
        if (chainId === 84532) {
            return '0xC4d7F06fE16e87B7D022337a165e443728d915EC' as `0x${string}`
        }
        // Fallback for other test chains — likely unset; revisit when used.
        return '0x5E85C2ACd361F924948311c69BfC69228D7761FF' as `0x${string}`
    }
}

export function getChains(isProd: boolean): Chain[] {
    return isProd ? PROD_CHAINS : TEST_CHAINS;
}

export function getChainConfig(ipfsServiceUrl: string): Record<number, ChainConfig> {
    return StatelessChainConfigProvider.getChainConfig(ipfsServiceUrl)
}

export function getDittoWFRegistryAddress(isProd: boolean, chainId?: number): `0x${string}` {
    return StatelessChainConfigProvider.getDittoWFRegistryAddress(isProd, chainId)
}

export function getDittoExecutorAddress(): `0x${string}` {
    return StatelessChainConfigProvider.getDittoExecutorAddress()
}

export function getDittoPolicyAddress(isProd: boolean, chainId?: number): `0x${string}` {
    return StatelessChainConfigProvider.getDittoPolicyAddress(isProd, chainId)
}

// Re-export enum for consumers expecting it from this module
export { ChainId } from './constants' 