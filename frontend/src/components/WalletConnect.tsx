import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { Button } from './ui/Button'
import { formatAddress } from '../lib/utils'
import { ChevronDown, LogOut, Wallet, ExternalLink, Copy, Search } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import toast from 'react-hot-toast'

export function WalletConnect() {
    const { disconnect } = useDisconnect()



    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success('Copied to clipboard!')
        } catch (error) {
            toast.error('Failed to copy to clipboard')
        }
    }

    const openExplorer = (address: string) => {
        const statusDashboardUrl = import.meta.env.VITE_STATUS_DASHBOARD_URI || 'http://localhost:3005'
        window.open(`${statusDashboardUrl}?account=${address}`, '_blank')
    }

    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
            }) => {
                const ready = mounted
                const connected = ready && account && chain

                return (
                    <div
                        {...(!ready && {
                            'aria-hidden': true,
                            style: {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <Button onClick={openConnectModal} variant="default">
                                        <Wallet className="mr-2 h-4 w-4" />
                                        Connect Wallet
                                    </Button>
                                )
                            }

                            if (chain.unsupported) {
                                return (
                                    <Button onClick={openChainModal} variant="destructive">
                                        Wrong network
                                    </Button>
                                )
                            }

                            return (
                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger asChild>
                                        <Button variant="outline" className="gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                                <span className="text-sm font-medium">
                                                    {account.displayName}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatAddress(account.address)}
                                                </span>
                                            </div>
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Portal>
                                        <DropdownMenu.Content
                                            className="min-w-[280px] rounded-md bg-popover p-1 shadow-md animate-slide-in"
                                            sideOffset={5}
                                        >
                                            {/* Wallet Address Section */}
                                            <div className="px-2 py-2 border-b border-border">
                                                <div className="text-xs text-muted-foreground mb-1">Wallet Address</div>
                                                <div className="flex items-center justify-between">
                                                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                                        {formatAddress(account.address)}
                                                    </code>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => copyToClipboard(account.address)}
                                                            className="text-xs text-blue-500 hover:text-blue-600 p-1"
                                                            title="Copy wallet address"
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => openExplorer(account.address)}
                                                            className="text-xs text-blue-500 hover:text-blue-600 p-1"
                                                            title="View workflows in explorer"
                                                        >
                                                            <Search className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <DropdownMenu.Item
                                                className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm outline-none hover:bg-accent"
                                                onClick={openAccountModal}
                                            >
                                                <Wallet className="mr-2 h-4 w-4" />
                                                Account Details
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm outline-none hover:bg-accent"
                                                onClick={openChainModal}
                                            >
                                                <ChevronDown className="mr-2 h-4 w-4" />
                                                Switch Network
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm outline-none hover:bg-accent"
                                                onClick={() => openExplorer(account.address)}
                                            >
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                View All Workflows
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Separator className="my-1 h-px bg-border" />
                                            <DropdownMenu.Item
                                                className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent"
                                                onClick={() => disconnect()}
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                Disconnect
                                            </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                            )
                        })()}
                    </div>
                )
            }}
        </ConnectButton.Custom>
    )
} 