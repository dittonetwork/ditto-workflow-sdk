import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { logger } from '../utils/logger'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatAddress(address: string): string {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatHash(hash: string): string {
    if (!hash) return ''
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}

export function formatDate(date: Date | string | number): string {
    let d: Date
    if (typeof date === 'number') {
        // Assume Unix timestamp in seconds if the number is small
        // JavaScript timestamps are in milliseconds
        d = date < 10000000000 ? new Date(date * 1000) : new Date(date)
    } else {
        d = new Date(date)
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(d)
}

export async function copyToClipboard(text: string): Promise<boolean> {
    if (!navigator?.clipboard) {
        return false
    }

    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch (error) {
        logger.error('Failed to copy to clipboard', error)
        return false
    }
}

export function downloadJson(data: any, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
} 