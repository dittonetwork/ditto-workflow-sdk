import React from 'react'
import { WagmiProvider, createConfig } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia, baseSepolia } from 'wagmi/chains'
import { Toaster } from 'react-hot-toast'
import '@rainbow-me/rainbowkit/styles.css'

import { WalletConnect } from './components/WalletConnect'
import { WorkflowBuilder } from './components/WorkflowBuilder'
import { ExecutorDashboard } from './components/ExecutorDashboard'
import { TransactionHistory } from './components/TransactionHistory'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/Tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { Input } from './components/ui/Input'
import { Label } from './components/ui/Label'
import { useAppStore } from './store/useAppStore'
import { appConfig } from './config/app.config'
import { useAccount } from 'wagmi'
import { Settings, Workflow as WorkflowIcon, Play } from 'lucide-react'
import { submitWorkflow, WorkflowBuilder as WBuilder, JobBuilder, IpfsStorage } from '../../src'
import { MemoryChainConfigProvider, setChainConfigProvider, ChainId } from '../../src/utils/chainConfigProvider'
import toast from 'react-hot-toast'
import { addressToEmptyAccount } from '@zerodev/sdk'
import { ThemeToggle } from './components/ThemeToggle'
import { logger } from './utils/logger'

const queryClient = new QueryClient()

// Используем публичный ключ для демо
const DEMO_PROJECT_ID = '2b7de5b47b7e78a4ba0a6db4c6109b3a'

function AppContent() {
    const { address, chain } = useAccount()
    const {
        isExecutorMode,
        setIsExecutorMode,
        ipfsServiceUrl,
        setIpfsServiceUrl,
        executorAddress,
        setExecutorAddress,
        selectedChainId,
        setSelectedChainId,
        currentWorkflow,
        addWorkflowToHistory,
        sepoliaRpcUrl,
        setSepoliaRpcUrl,
        baseSepoliaRpcUrl,
        setBaseSepoliaRpcUrl,
        sepoliaContract,
        setSepoliaContract,
        baseSepoliaContract,
        setBaseSepoliaContract,
    } = useAppStore()

    const handleSubmitWorkflow = async () => {
        if (!currentWorkflow || !address) {
            toast.error('Please create a workflow and connect wallet')
            return
        }

        try {
            const ownerAccount = addressToEmptyAccount(address as `0x${string}`)

            const workflowBuilder = WBuilder.create(ownerAccount)

            if (currentWorkflow.count) {
                workflowBuilder.setCount(currentWorkflow.count)
            }

            if (currentWorkflow.validAfter) {
                const d = new Date(currentWorkflow.validAfter)
                if (!isNaN(d.getTime())) workflowBuilder.setValidAfter(d)
            }

            if (currentWorkflow.validUntil) {
                const du = new Date(currentWorkflow.validUntil)
                if (!isNaN(du.getTime())) workflowBuilder.setValidUntil(du)
            }

            currentWorkflow.triggers.forEach((trigger: any) => {
                if (trigger.type === 'event') {
                    workflowBuilder.addEventTrigger(trigger.params)
                } else if (trigger.type === 'cron') {
                    workflowBuilder.addCronTrigger(trigger.params.expression)
                }
            })

            currentWorkflow.jobs.forEach((job: any) => {
                const jobBuilder = JobBuilder.create(job.id)
                    .setChainId(job.chainId)

                job.steps.forEach((step: any) => {
                    jobBuilder.addStep({
                        target: step.target,
                        abi: step.abi,
                        args: step.args || [],
                        value: BigInt(step.value || 0)
                    })
                })

                workflowBuilder.addJob(jobBuilder.build())
            })

            const workflow = workflowBuilder.build()

            const provider = new MemoryChainConfigProvider()
            provider.setRpcUrl(ChainId.SEPOLIA, sepoliaRpcUrl || appConfig.chains.sepolia.rpcUrl)
            provider.setRpcUrl(ChainId.BASE_SEPOLIA, baseSepoliaRpcUrl || appConfig.chains.baseSepolia.rpcUrl)
            setChainConfigProvider(provider)

            const storage = new IpfsStorage(ipfsServiceUrl || appConfig.ipfs.serviceUrl)

            const result = await submitWorkflow(
                workflow,
                (executorAddress || address) as `0x${string}`,
                storage,
                window.ethereum!
            )

            addWorkflowToHistory({
                ipfsHash: result.ipfsHash,
                transactionHash: result.userOpHashes[0]?.receipt?.transactionHash || '',
                createdAt: Math.floor(Date.now() / 1000),
                chainId: selectedChainId,
            })

            toast.success('Workflow submitted successfully!')
        } catch (error) {
            logger.error('Error submitting workflow', error)
            toast.error('Failed to submit workflow')
        }
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold">Workflow SDK</h1>
                        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1">
                            <Button
                                variant={!isExecutorMode ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setIsExecutorMode(false)}
                            >
                                <WorkflowIcon className="mr-2 h-4 w-4" />
                                Creator
                            </Button>
                            <Button
                                variant={isExecutorMode ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setIsExecutorMode(true)}
                            >
                                <Play className="mr-2 h-4 w-4" />
                                Executor
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <WalletConnect />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4">
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Sidebar - Settings */}
                    <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5" />
                                    Configuration
                                </CardTitle>
                                <CardDescription>
                                    Override default settings
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="ipfs-url">IPFS Service URL</Label>
                                    <Input
                                        id="ipfs-url"
                                        value={ipfsServiceUrl}
                                        onChange={(e) => setIpfsServiceUrl(e.target.value)}
                                        placeholder={appConfig.ipfs.serviceUrl}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="executor">Executor Address</Label>
                                    <Input
                                        id="executor"
                                        value={executorAddress}
                                        onChange={(e) => setExecutorAddress(e.target.value)}
                                        placeholder={address || '0x...'}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="chain">Active Chain</Label>
                                    <select
                                        id="chain"
                                        value={selectedChainId}
                                        onChange={(e) => setSelectedChainId(Number(e.target.value))}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                                    >
                                        {Object.values(appConfig.chains).map(chain => (
                                            <option key={chain.id} value={chain.id}>{chain.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="sepolia-rpc">Sepolia RPC URL</Label>
                                    <Input
                                        id="sepolia-rpc"
                                        value={sepoliaRpcUrl}
                                        onChange={(e) => setSepoliaRpcUrl(e.target.value)}
                                        placeholder="https://..."
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Get free RPC from Alchemy, Infura, or use public endpoints
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="base-rpc">Base Sepolia RPC URL</Label>
                                    <Input
                                        id="base-rpc"
                                        value={baseSepoliaRpcUrl}
                                        onChange={(e) => setBaseSepoliaRpcUrl(e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="sepolia-contract">Sepolia Contract</Label>
                                    <Input
                                        id="sepolia-contract"
                                        value={sepoliaContract}
                                        onChange={(e) => setSepoliaContract(e.target.value)}
                                        placeholder="0x..."
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="base-contract">Base Sepolia Contract</Label>
                                    <Input
                                        id="base-contract"
                                        value={baseSepoliaContract}
                                        onChange={(e) => setBaseSepoliaContract(e.target.value)}
                                        placeholder="0x..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Transaction History */}
                        <div className="mt-6">
                            <TransactionHistory />
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-2">
                        {!isExecutorMode ? (
                            <div className="space-y-6">
                                <WorkflowBuilder />
                                <Card>
                                    <CardContent className="pt-6">
                                        <Button
                                            onClick={handleSubmitWorkflow}
                                            disabled={!currentWorkflow || !address}
                                            className="w-full"
                                        >
                                            Submit Workflow to Blockchain
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <ExecutorDashboard />
                        )}
                    </div>
                </div>
            </main>

            <Toaster
                position="bottom-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: 'hsl(var(--background))',
                        color: 'hsl(var(--foreground))',
                        border: '1px solid hsl(var(--border))',
                    },
                }}
            />
        </div>
    )
}

function App() {
    // Configure wagmi with fixed projectId
    const config = React.useMemo(() =>
        getDefaultConfig({
            appName: 'Workflow SDK',
            projectId: DEMO_PROJECT_ID,
            chains: [sepolia, baseSepolia],
            ssr: false,
        }),
        []
    )

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    <AppContent />
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}

export default App 