export enum WorkflowErrorCode {
    INVALID_SERIALIZED_DATA = 'INVALID_SERIALIZED_DATA',
    INVALID_CHAIN_ID = 'INVALID_CHAIN_ID',
    INVALID_BIGINT = 'INVALID_BIGINT',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
}

export class WorkflowError extends Error {
    constructor(
        public readonly code: WorkflowErrorCode,
        message: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = 'WorkflowError';
    }
} 