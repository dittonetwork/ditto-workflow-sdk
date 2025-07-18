/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WALLETCONNECT_PROJECT_ID?: string
    readonly VITE_SEPOLIA_RPC_URL?: string
    readonly VITE_BASE_SEPOLIA_RPC_URL?: string
    readonly VITE_SEPOLIA_WORKFLOW_CONTRACT?: string
    readonly VITE_BASE_SEPOLIA_WORKFLOW_CONTRACT?: string
    readonly VITE_IPFS_SERVICE_URL?: string
    readonly VITE_IPFS_GATEWAY?: string
    readonly VITE_DITTO_API_URL?: string
    readonly VITE_DEFAULT_EXECUTOR_ADDRESS?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
} 