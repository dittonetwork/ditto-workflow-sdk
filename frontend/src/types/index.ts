import { Address, Hex } from 'viem'

export interface Step {
    target: string
    abi: string
    args: readonly string[]
    value: string
}

export interface Job {
    id: string
    steps: Step[]
    chainId: number
    session?: string
}

export interface Workflow {
    count: number
    validAfter: Date
    validUntil: Date
    interval?: number
    triggers: Trigger[]
    jobs: Job[]
}

export type Trigger = EventTrigger | CronTrigger | TimeTrigger | OnchainTrigger

export interface OnchainTrigger {
    type: 'onchain'
    target: Address
    abi: string
    args: readonly string[]
    value?: string
    chainId: number
}

export interface EventTrigger {
    type: 'event'
    signature: string
    contractAddress: Address
    chainId: number
    filter?: Record<string, string>
}

export interface CronTrigger {
    type: 'cron'
    schedule: string
}

export interface TimeTrigger {
    type: 'time'
    timestamp: number
}

export interface WorkflowData {
    ipfsHash: string
    transactionHash: string
    createdAt: number
    chainId: number
}

export interface WorkflowEvent {
    ipfsHash: string
    blockNumber: bigint
    transactionHash: string
}

export interface ChainConfig {
    id: number
    name: string
    rpcUrl: string
    blockExplorer: string
    multicallAddress: string
    workflowContract: string
}

export interface WorkflowFormData {
    count: number
    validAfter: string
    validUntil: string
    triggers: Array<{
        type: 'event' | 'cron' | 'manual' | 'onchain'
        params: {
            signature?: string
            contractAddress?: string
            chainId?: number
            filter?: Record<string, string>
            expression?: string
            target?: string
            abi?: string
            args?: string[]
            value?: string
        }
    }>
    jobs: Array<{
        id: string
        chainId: number
        steps: Array<{
            target: string
            abi: string
            args: string[]
            value: string
        }>
    }>
} 