import { isAddress } from 'viem'

export const isValidBigIntString = (value: string): boolean => {
    if (!value || value.trim() === '') return false
    try {
        BigInt(value)
        return true
    } catch {
        return false
    }
}

export const safeBigInt = (value: string, defaultValue: bigint = 0n): bigint => {
    try {
        return BigInt(value)
    } catch {
        return defaultValue
    }
}

export const isValidAddress = (address: string): boolean => {
    return isAddress(address)
}

export const isValidChainId = (chainId: number): boolean => {
    const supportedChains = [11155111, 84532] // Sepolia and Base Sepolia
    return supportedChains.includes(chainId)
}

export const formatAddress = (address: string, length: number = 10): string => {
    if (!address || address.length < length * 2) return address
    return `${address.slice(0, length)}...${address.slice(-length)}`
}

export const formatHash = (hash: string, length: number = 10): string => {
    if (!hash || hash.length < length * 2) return hash
    return `${hash.slice(0, length)}...${hash.slice(-length)}`
}

export const parseAbiSafe = (abi: string): { name: string; args: Array<{ name: string; type: string }> } | null => {
    try {
        const match = abi.match(/^(\w+)\s*\((.*)\)$/)
        if (!match) return null

        const [, name, argsString] = match
        if (!argsString) return { name, args: [] }

        const args = argsString.split(',').map(arg => {
            const parts = arg.trim().split(/\s+/)
            const type = parts[0]
            const argName = parts[parts.length - 1] || ''
            return { name: argName, type }
        })

        return { name, args }
    } catch {
        return null
    }
}

export const parseCronExpression = (expression: string): boolean => {
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
    return cronRegex.test(expression)
} 