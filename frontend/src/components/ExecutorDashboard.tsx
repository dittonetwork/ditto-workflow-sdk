import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { IpfsPreview } from './IpfsPreview'
import { IpfsStorage, executeFromIpfs } from '../../../src'
import { MemoryChainConfigProvider, setChainConfigProvider, ChainId } from '../../../src/utils/chainConfigProvider'
import { useAccount, usePublicClient } from 'wagmi'
import { parseAbiItem, decodeEventLog } from 'viem'
import { RefreshCw, Play, Search, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '../store/useAppStore'
import { appConfig } from '../config/app.config'
import { WorkflowEvent } from '../types'
import { formatHash } from '../utils/validation'
import { generateHash } from '../utils/hash'
import { logger } from '../utils/logger'

export function ExecutorDashboard() {
    const { address, chain } = useAccount()
    const publicClient = usePublicClient()
    const {
        ipfsServiceUrl,
        selectedChainId,
        previewData,
        setPreviewData,
        sepoliaRpcUrl,
        baseSepoliaRpcUrl,
        sepoliaContract,
        baseSepoliaContract
    } = useAppStore()

    const [events, setEvents] = useState<WorkflowEvent[]>([])
    const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [executing, setExecuting] = useState(false)
    const [contractAddress, setContractAddress] = useState('')
    const [rpcUrl, setRpcUrl] = useState('')
    const [currentPage, setCurrentPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)

    const EVENTS_PER_PAGE = 500n

    const chainConfig = useMemo(() =>
        appConfig.chains[selectedChainId === 11155111 ? 'sepolia' : 'baseSepolia'],
        [selectedChainId]
    )

    useEffect(() => {
        // Use values from store or fallback to config
        const configuredContract = selectedChainId === 11155111
            ? (sepoliaContract || chainConfig.workflowContract)
            : (baseSepoliaContract || chainConfig.workflowContract)

        const configuredRpc = selectedChainId === 11155111
            ? (sepoliaRpcUrl || chainConfig.rpcUrl)
            : (baseSepoliaRpcUrl || chainConfig.rpcUrl)

        setContractAddress(configuredContract)
        setRpcUrl(configuredRpc)
    }, [chainConfig, selectedChainId, sepoliaContract, baseSepoliaContract, sepoliaRpcUrl, baseSepoliaRpcUrl])

    const loadEvents = async (append: boolean = false) => {
        if (!publicClient || !contractAddress) {
            toast.error('Please connect wallet and set contract address')
            return
        }

        setLoading(true)
        try {
            const event = parseAbiItem('event Created(string ipfsHash)') as any
            const latest = await publicClient.getBlockNumber()
            const fromBlock = latest > (EVENTS_PER_PAGE * BigInt(currentPage + 1))
                ? latest - (EVENTS_PER_PAGE * BigInt(currentPage + 1))
                : 0n
            const toBlock = latest - (EVENTS_PER_PAGE * BigInt(currentPage))

            const logs = await publicClient.getLogs({
                address: contractAddress as `0x${string}`,
                event,
                fromBlock,
                toBlock,
            })

            const formattedEvents = logs.map((log: any) => {
                const decoded = decodeEventLog({
                    abi: [event],
                    data: log.data,
                    topics: log.topics
                }) as { args: { ipfsHash: string } }
                return {
                    ipfsHash: decoded.args.ipfsHash,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                }
            })

            if (append) {
                setEvents(prev => [...prev, ...formattedEvents.reverse()])
            } else {
                setEvents(formattedEvents.reverse())
            }

            setHasMore(formattedEvents.length === Number(EVENTS_PER_PAGE))
            toast.success(`Found ${formattedEvents.length} workflows`)
        } catch (error) {
            logger.error('Error loading events', error)
            toast.error('Failed to load workflow events')
        } finally {
            setLoading(false)
        }
    }

    const loadMore = () => {
        setCurrentPage(prev => prev + 1)
        loadEvents(true)
    }

    const downloadWorkflow = async (ipfsHash: string) => {
        if (!ipfsHash) return

        setLoading(true)
        try {
            const storage = new IpfsStorage(ipfsServiceUrl || appConfig.ipfs.serviceUrl)
            const data = await storage.download(ipfsHash)
            setPreviewData(data)
            setSelectedWorkflow(ipfsHash)
            toast.success('Workflow loaded successfully')
        } catch (error) {
            logger.error('Error downloading workflow', error)
            toast.error('Failed to download workflow')
        } finally {
            setLoading(false)
        }
    }

    const executeWorkflow = async () => {
        if (!selectedWorkflow || !address) {
            toast.error('Please select a workflow and connect wallet')
            return
        }

        setExecuting(true)
        try {

            const provider = new MemoryChainConfigProvider()
            if (selectedChainId === 11155111) {
                provider.setRpcUrl(ChainId.SEPOLIA, rpcUrl)
            } else if (selectedChainId === 84532) {
                provider.setRpcUrl(ChainId.BASE_SEPOLIA, rpcUrl)
            }
            setChainConfigProvider(provider)

            const storage = new IpfsStorage(ipfsServiceUrl || appConfig.ipfs.serviceUrl)
            const result = await executeFromIpfs(
                selectedWorkflow,
                storage,
                window.ethereum!,
                0n,
                false
            )

            if (result.success) {
                toast.success('Workflow executed successfully!')
                logger.info('Execution results', result.results)
            } else {
                toast.error('Workflow execution failed')
                logger.error('Execution results', result.results)
            }
        } catch (error) {
            logger.error('Error executing workflow', error)
            toast.error('Failed to execute workflow')
        } finally {
            setExecuting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Executor Configuration</CardTitle>
                    <CardDescription>Configure executor settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="contract">Workflow Contract</Label>
                            <Input
                                id="contract"
                                value={contractAddress}
                                onChange={(e) => setContractAddress(e.target.value)}
                                placeholder="0x..."
                            />
                        </div>
                        <div>
                            <Label htmlFor="rpc">RPC URL</Label>
                            <Input
                                id="rpc"
                                value={rpcUrl}
                                onChange={(e) => setRpcUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <Button onClick={() => loadEvents(false)} disabled={loading} type="button">
                        {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Load Workflows
                    </Button>
                </CardContent>
            </Card>

            {/* Workflow List */}
            <Card>
                <CardHeader>
                    <CardTitle>Available Workflows</CardTitle>
                    <CardDescription>Select a workflow to view and execute</CardDescription>
                </CardHeader>
                <CardContent>
                    {events.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No workflows found. Click "Load Workflows" to search.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {events.map((event, index) => (
                                <div
                                    key={generateHash({ hash: event.ipfsHash, tx: event.transactionHash, block: event.blockNumber.toString() })}
                                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${selectedWorkflow === event.ipfsHash
                                        ? 'border-primary bg-accent'
                                        : 'hover:bg-accent'
                                        }`}
                                    onClick={() => downloadWorkflow(event.ipfsHash)}
                                >
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{event.ipfsHash}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Block: {event.blockNumber.toString()} • Tx: {formatHash(event.transactionHash)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            downloadWorkflow(event.ipfsHash)
                                        }}
                                    >
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {hasMore && (
                                <Button
                                    variant="outline"
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="w-full mt-2"
                                    type="button"
                                >
                                    {loading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        'Load More'
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Preview and Execute */}
            {previewData && selectedWorkflow && (
                <>
                    <IpfsPreview
                        ipfsHash={selectedWorkflow}
                        data={previewData}
                        transactionHash={events.find(e => e.ipfsHash === selectedWorkflow)?.transactionHash}
                        chainId={selectedChainId}
                    />

                    <Card>
                        <CardContent className="pt-6">
                            <Button
                                onClick={executeWorkflow}
                                disabled={executing || !address}
                                className="w-full"
                            >
                                {executing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                )}
                                Execute Workflow
                            </Button>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
} 