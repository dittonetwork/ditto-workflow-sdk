type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
    level: LogLevel
    message: string
    data?: unknown
    timestamp: Date
}

class Logger {
    private isDevelopment = import.meta.env.DEV

    private log(level: LogLevel, message: string, data?: unknown): void {
        const entry: LogEntry = {
            level,
            message,
            data,
            timestamp: new Date()
        }

        if (this.isDevelopment) {
            const consoleMethod = level === 'debug' ? 'log' : level
            console[consoleMethod](`[${level.toUpperCase()}]`, message, data || '')
        }

        // В продакшене можно отправлять логи на сервер
        if (!this.isDevelopment && level === 'error') {
            // TODO: Implement error reporting service integration
            // Example: sendToErrorReportingService(entry)
        }
    }

    debug(message: string, data?: unknown): void {
        this.log('debug', message, data)
    }

    info(message: string, data?: unknown): void {
        this.log('info', message, data)
    }

    warn(message: string, data?: unknown): void {
        this.log('warn', message, data)
    }

    error(message: string, error?: unknown): void {
        const errorData = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error
        this.log('error', message, errorData)
    }
}

export const logger = new Logger() 