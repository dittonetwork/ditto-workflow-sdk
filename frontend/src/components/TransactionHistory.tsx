import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { formatHash, formatDate } from '../lib/utils'
import { ExternalLink, FileJson, Clock } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface TransactionHistoryProps {
    onSelectWorkflow?: (ipfsHash: string) => void
}

export function TransactionHistory({ onSelectWorkflow }: TransactionHistoryProps) {
    const { workflowHistory } = useAppStore()

    const getChainName = (chainId: number) => {
        const chains: Record<number, string> = {
            11155111: 'Sepolia',
            84532: 'Base Sepolia',
        }
        return chains[chainId] || `Chain ${chainId}`
    }

    const getExplorerUrl = (chainId: number, hash: string) => {
        const explorers: Record<number, string> = {
            11155111: 'https://sepolia.etherscan.io',
            84532: 'https://sepolia.basescan.org',
        }
        return `${explorers[chainId]}/tx/${hash}`
    }

    if (workflowHistory.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>Your submitted workflows will appear here</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <FileJson className="mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No workflows submitted yet</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Recent workflow submissions</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {workflowHistory.map((item, index) => (
                        <div
                            key={`${item.ipfsHash}-${index}`}
                            className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                        >
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <FileJson className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">
                                        {formatHash(item.ipfsHash)}
                                    </span>
                                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                                        {getChainName(item.chainId)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDate(item.createdAt)}
                                    </span>
                                    <span>
                                        Tx: {formatHash(item.transactionHash)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {onSelectWorkflow && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onSelectWorkflow(item.ipfsHash)}
                                    >
                                        View
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                >
                                    <a
                                        href={getExplorerUrl(item.chainId, item.transactionHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
} 