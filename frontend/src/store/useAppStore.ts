import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WorkflowData, WorkflowFormData } from '../types'

interface AppState {
    // Wallet management
    activeWalletIndex: number
    setActiveWalletIndex: (index: number) => void

    // UI state
    isExecutorMode: boolean
    setIsExecutorMode: (mode: boolean) => void

    // Workflow history
    workflowHistory: WorkflowData[]
    addWorkflowToHistory: (workflow: WorkflowData) => void

    // Config overrides
    ipfsServiceUrl: string
    setIpfsServiceUrl: (url: string) => void

    executorAddress: string
    setExecutorAddress: (address: string) => void

    selectedChainId: number
    setSelectedChainId: (chainId: number) => void

    // RPC URLs
    sepoliaRpcUrl: string
    setSepoliaRpcUrl: (url: string) => void
    baseSepoliaRpcUrl: string
    setBaseSepoliaRpcUrl: (url: string) => void

    // Contract addresses
    sepoliaContract: string
    setSepoliaContract: (address: string) => void
    baseSepoliaContract: string
    setBaseSepoliaContract: (address: string) => void

    // Workflow builder state
    currentWorkflow: WorkflowFormData | null
    setCurrentWorkflow: (workflow: WorkflowFormData | null) => void

    // IPFS preview
    previewData: unknown | null
    setPreviewData: (data: unknown | null) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Wallet management
            activeWalletIndex: 0,
            setActiveWalletIndex: (index) => set({ activeWalletIndex: index }),

            // UI state
            isExecutorMode: false,
            setIsExecutorMode: (mode) => set({ isExecutorMode: mode }),

            // Workflow history
            workflowHistory: [],
            addWorkflowToHistory: (workflow) =>
                set((state) => ({
                    workflowHistory: [workflow, ...state.workflowHistory].slice(0, 50), // Keep last 50
                })),

            // Config overrides
            ipfsServiceUrl: 'https://ipfs-service.develop.dittonetwork.io/ipfs',
            setIpfsServiceUrl: (url) => set({ ipfsServiceUrl: url }),

            executorAddress: '',
            setExecutorAddress: (address) => set({ executorAddress: address }),

            selectedChainId: 11155111, // Default to Sepolia
            setSelectedChainId: (chainId) => set({ selectedChainId: chainId }),

            // RPC URLs
            sepoliaRpcUrl: 'https://rpc.zerodev.app/api/v3/420c3c6a-22f4-4956-b567-1ae05cd18da9/chain/11155111',
            setSepoliaRpcUrl: (url) => set({ sepoliaRpcUrl: url }),
            baseSepoliaRpcUrl: '',
            setBaseSepoliaRpcUrl: (url) => set({ baseSepoliaRpcUrl: url }),

            // Contract addresses
            sepoliaContract: '0x5CE5E78588F4dC8556E2c607134e8b76567AECE6',
            setSepoliaContract: (address) => set({ sepoliaContract: address }),
            baseSepoliaContract: '',
            setBaseSepoliaContract: (address: string) => set({ baseSepoliaContract: address }),

            // Workflow builder state
            currentWorkflow: null,
            setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),

            // IPFS preview
            previewData: null,
            setPreviewData: (data) => set({ previewData: data }),
        }),
        {
            name: 'workflow-app-storage',
            partialize: (state) => ({
                ipfsServiceUrl: state.ipfsServiceUrl,
                executorAddress: state.executorAddress,
                selectedChainId: state.selectedChainId,
                workflowHistory: state.workflowHistory,
                sepoliaRpcUrl: state.sepoliaRpcUrl,
                baseSepoliaRpcUrl: state.baseSepoliaRpcUrl,
                sepoliaContract: state.sepoliaContract,
                baseSepoliaContract: state.baseSepoliaContract,
                currentWorkflow: state.currentWorkflow,
                isExecutorMode: state.isExecutorMode,
                activeWalletIndex: state.activeWalletIndex,
            }),
        }
    )
) 