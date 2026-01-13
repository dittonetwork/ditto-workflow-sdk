import { Logger, getDefaultLogger } from './Logger';

/**
 * WASM Reference - describes a WASM step execution
 */
export interface WasmRef {
  /** SHA256 hash of WASM (hex, required) - WASM bytes are retrieved from MongoDB */
  wasmHash: string;
  /** Input JSON for WASM execution */
  input: any;
  /** Unique identifier for this WASM step */
  id: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Resolved WASM Reference - result of WASM execution
 */
export interface ResolvedWasmRef {
  /** Original WASM reference */
  ref: WasmRef;
  /** The resolved result from WASM execution */
  result: any;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Context for WASM execution results
 */
export interface WasmRefContext {
  /** All resolved WASM references with their results */
  resolvedRefs: ResolvedWasmRef[];
}

/**
 * Marker prefix for serialized WASM references in step arguments
 * Format: "$wasm:{wasmId}"
 */
export const WASM_REF_PREFIX = '$wasm:';

/**
 * Check if a value is a WASM reference string
 */
export function isWasmRefString(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(WASM_REF_PREFIX);
}

/**
 * Parse a WASM reference from its string representation
 */
export function parseWasmRef(value: string): string {
  if (!isWasmRefString(value)) {
    throw new Error(`Invalid WASM reference format: ${value}`);
  }
  return value.slice(WASM_REF_PREFIX.length);
}

/**
 * Create a WASM reference string from a WASM step ID
 */
export function createWasmRefString(wasmId: string): string {
  return WASM_REF_PREFIX + wasmId;
}

/**
 * Resolves WASM steps and allows referencing their results in subsequent steps.
 * 
 * Similar to DataRefResolver, but for WASM execution.
 * WASM steps are executed before contract steps, and their results can be
 * referenced in subsequent step arguments using $wasm:{wasmId}.
 */
export class WasmRefResolver {
  private logger: Logger;
  private wasmClient: any; // WasmClient type from simulator
  private database: any; // Database instance from simulator
  private context: WasmRefContext;

  /**
   * Create a WasmRefResolver
   * @param wasmClient - WASM client instance (from simulator)
   * @param database - Database instance for fetching WASM bytes by hash
   * @param existingContext - If provided, use existing context (operator mode)
   * @param logger - Logger instance
   */
  constructor(
    wasmClient: any,
    database: any,
    existingContext?: WasmRefContext,
    logger: Logger = getDefaultLogger()
  ) {
    this.wasmClient = wasmClient;
    this.database = database;
    this.logger = logger;
    this.context = existingContext ?? { resolvedRefs: [] };
  }

  /**
   * Get the resolution context (for passing to operators)
   */
  getContext(): WasmRefContext {
    return this.context;
  }

  /**
   * Execute a WASM step and store the result
   */
  async executeWasmStep(ref: WasmRef): Promise<ResolvedWasmRef> {
    if (!this.wasmClient) {
      throw new Error('WASM client not available');
    }
    if (!this.database) {
      throw new Error('Database not available for WASM module lookup');
    }

    this.logger.info(`Executing WASM step: ${ref.id} (hash: ${ref.wasmHash})`);

    // Fetch WASM bytes from MongoDB by hash
    const wasmBytes = await this.database.getWasmModule(ref.wasmHash);
    if (!wasmBytes) {
      throw new Error(`WASM module not found in database: ${ref.wasmHash}. Indexer may need to fetch it from IPFS.`);
    }

    // Convert to base64 for WASM client
    const wasmB64 = wasmBytes.toString('base64');

    const startTime = Date.now();
    
    try {
      const wasmResult = await this.wasmClient.run({
        jobId: `wasm-step-${ref.id}-${Date.now()}`,
        wasmHash: ref.wasmHash,
        wasmB64: wasmB64,
        input: ref.input,
        timeoutMs: ref.timeoutMs || 2000,
      });

      const durationMs = Date.now() - startTime;

      if (!wasmResult.ok) {
        throw new Error(`WASM execution failed: ${wasmResult.error || 'Unknown error'}`);
      }

      const resolved: ResolvedWasmRef = {
        ref,
        result: wasmResult.result,
        durationMs,
      };

      this.context.resolvedRefs.push(resolved);
      this.logger.info(`WASM step ${ref.id} completed in ${durationMs}ms`);

      return resolved;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`WASM step ${ref.id} failed after ${durationMs}ms:`, error);
      throw new Error(`WASM execution failed for step ${ref.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve a single argument value - if it's a WASM ref, resolve it; otherwise return as-is
   */
  async resolveArg(arg: any): Promise<any> {
    // Handle WASM reference strings
    if (isWasmRefString(arg)) {
      const wasmId = parseWasmRef(arg);
      const resolved = this.context.resolvedRefs.find(r => r.ref.id === wasmId);
      if (!resolved) {
        throw new Error(`WASM reference not found: ${wasmId}`);
      }
      return resolved.result;
    }
    
    // Handle nested arrays
    if (Array.isArray(arg)) {
      return Promise.all(arg.map(item => this.resolveArg(item)));
    }
    
    // Handle nested objects (but not null)
    if (arg !== null && typeof arg === 'object') {
      const resolved: Record<string, any> = {};
      for (const [key, value] of Object.entries(arg)) {
        resolved[key] = await this.resolveArg(value);
      }
      return resolved;
    }
    
    // Return primitive values as-is
    return arg;
  }

  /**
   * Resolve all WASM references in an array of arguments
   */
  async resolveArgs(args: readonly any[]): Promise<any[]> {
    return Promise.all(args.map(arg => this.resolveArg(arg)));
  }

  /**
   * Check if any arguments contain WASM references
   */
  static hasWasmRefs(args: readonly any[]): boolean {
    const check = (value: any): boolean => {
      if (isWasmRefString(value)) return true;
      if (Array.isArray(value)) return value.some(check);
      if (value !== null && typeof value === 'object') {
        return Object.values(value).some(check);
      }
      return false;
    };
    return args.some(check);
  }
}
