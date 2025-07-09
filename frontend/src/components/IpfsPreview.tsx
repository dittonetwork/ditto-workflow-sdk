import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Copy, Download, ExternalLink } from 'lucide-react'
import { formatHash, copyToClipboard, downloadJson } from '../lib/utils'
import toast from 'react-hot-toast'

interface IpfsPreviewProps {
    ipfsHash: string
    data: any
    transactionHash?: string
    chainId?: number
}

export function IpfsPreview({ ipfsHash, data, transactionHash, chainId }: IpfsPreviewProps) {
    const handleCopy = async (text: string, label: string) => {
        const success = await copyToClipboard(text)
        if (success) {
            toast.success(`${label} copied to clipboard`)
        } else {
            toast.error('Failed to copy to clipboard')
        }
    }

    const handleDownload = () => {
        downloadJson(data, `workflow-${ipfsHash}.json`)
    }

    const getExplorerUrl = (hash: string) => {
        if (!chainId) return ''
        const explorers: Record<number, string> = {
            11155111: 'https://sepolia.etherscan.io',
            84532: 'https://sepolia.basescan.org',
        }
        return `${explorers[chainId]}/tx/${hash}`
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>IPFS Content Preview</CardTitle>
                        <CardDescription>
                            Workflow data from IPFS
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Download JSON
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* IPFS Hash */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                        <p className="text-sm font-medium">IPFS Hash</p>
                        <p className="text-xs text-muted-foreground">{formatHash(ipfsHash)}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(ipfsHash, 'IPFS hash')}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                        <a
                            href={`https://ipfs.io/ipfs/${ipfsHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Transaction Hash */}
                {transactionHash && (
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <p className="text-sm font-medium">Transaction Hash</p>
                            <p className="text-xs text-muted-foreground">{formatHash(transactionHash)}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(transactionHash, 'Transaction hash')}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            {chainId && (
                                <a
                                    href={getExplorerUrl(transactionHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* JSON Preview */}
                <div className="rounded-lg border p-4">
                    <h4 className="mb-2 text-sm font-medium">Workflow Data</h4>
                    <div className="max-h-[400px] overflow-auto scrollbar-thin">
                        <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 p-4 rounded-md">
                            <code className="language-json">
                                {JSON.stringify(data, null, 2)}
                            </code>
                        </pre>
                    </div>
                </div>

                {/* Workflow Summary */}
                {data?.workflow && (
                    <div className="rounded-lg bg-muted p-4">
                        <h4 className="mb-2 text-sm font-medium">Workflow Summary</h4>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                            <dt className="text-muted-foreground">Owner:</dt>
                            <dd className="font-mono text-xs">{data.workflow.owner}</dd>

                            <dt className="text-muted-foreground">Jobs:</dt>
                            <dd>{data.workflow.jobs?.length || 0}</dd>

                            <dt className="text-muted-foreground">Triggers:</dt>
                            <dd>{data.workflow.triggers?.length || 0}</dd>

                            <dt className="text-muted-foreground">Max Executions:</dt>
                            <dd>{data.workflow.count || 'Unlimited'}</dd>

                            <dt className="text-muted-foreground">Valid Until:</dt>
                            <dd>{data.workflow.validUntil ? new Date(data.workflow.validUntil).toLocaleString() : 'No expiration'}</dd>
                        </dl>
                    </div>
                )}
            </CardContent>
        </Card>
    )
} 