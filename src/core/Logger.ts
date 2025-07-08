import pino from 'pino';

export interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}

export class ConsoleLogger implements Logger {
    info(message: string, ...args: any[]): void {
        (globalThis as any).console.log(message, ...args);
    }

    error(message: string, ...args: any[]): void {
        (globalThis as any).console.error(message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        (globalThis as any).console.debug(message, ...args);
    }
}

export class PinoLogger implements Logger {
    private readonly logger = pino();
    info(message: string, ...args: any[]): void {
        this.logger.info({ extra: args }, message);
    }
    error(message: string, ...args: any[]): void {
        this.logger.error({ extra: args }, message);
    }
    debug(message: string, ...args: any[]): void {
        this.logger.debug({ extra: args }, message);
    }
}

export function getDefaultLogger(): Logger {
    if (process.env.NODE_ENV === 'production') {
        return new PinoLogger();
    }
    return new ConsoleLogger();
} 