export const appConfig = {
    // Default chain configurations
    chains: {
        sepolia: {
            id: 11155111,
            name: 'Sepolia',
            rpcUrl: 'https://rpc.ankr.com/eth_sepolia',
            blockExplorer: 'https://sepolia.etherscan.io',
            // Multicall3 contract address - deployed on most chains at the same address
            // See: https://www.multicall3.com/deployments
            multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
            workflowContract: '',
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
        serviceUrl: 'https://api.ditto.network/ipfs',
        gateway: 'https://ipfs.io/ipfs',
    },

    // Ditto API Configuration
    api: {
        baseUrl: 'https://api.ditto.network',
    },

    // Default executor addresses (can be overridden in UI)
    executors: [
        {
            name: 'Default Executor',
            address: '',
            description: 'Primary executor for workflow execution',
        },
    ],

    // Preset workflow templates
    workflowTemplates: [
        {
            id: 'nft-mint',
            name: 'NFT Mint',
            description: 'Mint NFT on trigger event',
            template: {
                count: 1,
                validAfter: new Date(),
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                triggers: [
                    {
                        type: 'event',
                        params: {
                            signature: 'Transfer(address indexed from, address indexed to, uint256 value)',
                            contractAddress: '',
                            chainId: 11155111,
                            filter: {},
                        },
                    },
                ],
                jobs: [
                    {
                        id: 'mint-job',
                        chainId: 11155111,
                        steps: [
                            {
                                target: '',
                                abi: 'mint(address)',
                                args: [''],
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