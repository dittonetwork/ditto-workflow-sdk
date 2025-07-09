import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { Button } from './ui/Button'
import { formatAddress } from '../lib/utils'
import { ChevronDown, LogOut, Wallet } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export function WalletConnect() {
    const { disconnect } = useDisconnect()

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
                                            className="min-w-[200px] rounded-md bg-popover p-1 shadow-md animate-slide-in"
                                            sideOffset={5}
                                        >
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