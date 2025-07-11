export const appConfig = {
    // Default chain configurations
    chains: {
        sepolia: {
            id: 11155111,
            name: 'Sepolia',
            rpcUrl: 'https://rpc.zerodev.app/api/v3/420c3c6a-22f4-4956-b567-1ae05cd18da9/chain/11155111',
            blockExplorer: 'https://sepolia.etherscan.io',
            // Multicall3 contract address - deployed on most chains at the same address
            // See: https://www.multicall3.com/deployments
            multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
            workflowContract: '0x34bE7f35132E97915633BC1fc020364EA5134863',
        },
        baseSepolia: {
            id: 84532,
            name: 'Base Sepolia',
            rpcUrl: 'https://sepolia.base.org',
            blockExplorer: 'https://sepolia.basescan.org',
            // Multicall3 contract address
            multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
            workflowContract: '',
        },
    },

    // IPFS Configuration
    ipfs: {
        serviceUrl: 'https://ipfs-service.develop.dittonetwork.io/ipfs',
        gateway: 'https://ipfs.io/ipfs',
    },

    // Ditto API Configuration
    api: {
        baseUrl: 'https://ipfs-service.develop.dittonetwork.io',
    },

    // Default executor addresses (can be overridden in UI)
    executors: [
        {
            name: 'Default Executor',
            address: '0xe29fe250607469eAA9d5A3C3957a521C0872cD1a',
            description: 'Primary executor for workflow execution',
        },
    ],

    // Preset workflow templates
    workflowTemplates: [
        {
            id: 'nft-mint',
            name: 'NFT Mint Template',
            description: 'Pre-configured NFT minting workflow with cron trigger',
            template: {
                count: 3,
                validAfter: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
                triggers: [
                    {
                        type: 'cron',
                        params: {
                            expression: '*/5 * * * *', // Every 5 minutes
                        },
                    },
                ],
                jobs: [
                    {
                        id: 'mint-nft-job-sepolia',
                        chainId: 11155111,
                        steps: [
                            {
                                target: '0x34bE7f35132E97915633BC1fc020364EA5134863',
                                abi: 'mint(address)',
                                args: ['{{ownerAccount.address}}'], // This will be replaced with actual address
                                value: '0',
                            },
                        ],
                    },
                ],
            },
        },
        {
            id: 'price-feed',
            name: 'Price Feed Check',
            description: 'Check price feed and execute action',
            template: {
                count: 5,
                validAfter: new Date(),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                triggers: [
                    {
                        type: 'cron',
                        params: {
                            expression: '0 */6 * * *', // Every 6 hours
                        },
                    },
                ],
                jobs: [
                    {
                        id: 'price-check-job',
                        chainId: 11155111,
                        steps: [
                            {
                                // Chainlink ETH/USD price feed on Sepolia
                                // See: https://docs.chain.link/data-feeds/price-feeds/addresses
                                target: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
                                abi: 'latestRoundData()',
                                args: [],
                                value: '0',
                            },
                        ],
                    },
                ],
            },
        },
    ],

    // UI Settings
    ui: {
        theme: 'light', // 'light' | 'dark' | 'system'
        compactMode: false,
        showAdvancedOptions: false,
    },

    // Feature flags
    features: {
        multiWallet: true,
        workflowTemplates: true,
        ipfsPreview: true,
        transactionHistory: true,
        advancedBuilder: true,
    },
};

export type AppConfig = typeof appConfig; 