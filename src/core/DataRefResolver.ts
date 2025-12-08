import { createPublicClient, http, parseAbiItem, AbiFunction, Address, PublicClient } from 'viem';
import { getChainConfig } from '../utils/chainConfigProvider';
import { authHttpConfig } from '../utils/httpTransport';
import { Logger, getDefaultLogger } from './Logger';

/**
 * Data Reference - describes a read call to fetch data from a contract
 * This is used to dynamically fetch data and pass it to subsequent steps
 */
export interface DataRef {
  /** Contract address to read from */
  target: Address;
  /** Function signature like "balanceOf(address)" or "getPrice() returns (uint256)" */
  abi: string;
  /** Arguments for the read call */
  args: readonly any[];
  /** Chain ID where the contract is deployed */
  chainId: number;
  /** 
   * Index of the result to use (for functions returning multiple values)
   * Default is 0 (first/only return value)
   */
  resultIndex?: number;
}

/**
 * Resolved Data Reference - result of a read call with block context
 * This is essential for deterministic consensus - operators must reproduce
 * the same read on the same block to get identical results
 */
export interface ResolvedDataRef {
  /** Original data reference */
  ref: DataRef;
  /** The resolved value from the contract */
  value: any;
  /** Block number at which the read was performed - critical for determinism */
  blockNumber: bigint;
}

/**
 * Context for deterministic data resolution across leader and operators
 * Leader creates this during simulation, operators use it for validation
 */
export interface DataRefContext {
  /** Mapping of chainId -> blockNumber used for reads */
  chainBlocks: Record<number, bigint>;
  /** All resolved data references with their values */
  resolvedRefs: ResolvedDataRef[];
}

/**
 * Marker prefix for serialized data references in step arguments
 * Format: "$ref:{...JSON DataRef...}"
 */
export const DATA_REF_PREFIX = '$ref:';

/**
 * Check if a value is a data reference string
 */
export function isDataRefString(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(DATA_REF_PREFIX);
}

/**
 * Parse a data reference from its string representation
 */
export function parseDataRef(value: string): DataRef {
  if (!isDataRefString(value)) {
    throw new Error(`Invalid data reference format: ${value}`);
  }
  const json = value.slice(DATA_REF_PREFIX.length);
  try {
    const parsed = JSON.parse(json);
    if (!parsed.target || !parsed.abi || !parsed.chainId) {
      throw new Error('DataRef must have target, abi, and chainId');
    }
    return {
      target: parsed.target,
      abi: parsed.abi,
      args: parsed.args ?? [],
      chainId: parsed.chainId,
      resultIndex: parsed.resultIndex,
    };
  } catch (error) {
    throw new Error(`Failed to parse DataRef: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a data reference string from a DataRef object
 */
export function createDataRefString(ref: DataRef): string {
  return DATA_REF_PREFIX + JSON.stringify({
    target: ref.target,
    abi: ref.abi,
    args: ref.args,
    chainId: ref.chainId,
    resultIndex: ref.resultIndex,
  });
}

/**
 * Helper to create a data reference for common patterns
 */
export function dataRef(params: {
  target: Address;
  abi: string;
  args?: readonly any[];
  chainId: number;
  resultIndex?: number;
}): string {
  return createDataRefString({
    target: params.target,
    abi: params.abi,
    args: params.args ?? [],
    chainId: params.chainId,
    resultIndex: params.resultIndex,
  });
}

/**
 * Serialize DataRefContext for transmission (handles BigInt)
 */
export function serializeDataRefContext(ctx: DataRefContext): string {
  return JSON.stringify({
    chainBlocks: Object.fromEntries(
      Object.entries(ctx.chainBlocks).map(([k, v]) => [k, v.toString()])
    ),
    resolvedRefs: ctx.resolvedRefs.map(r => ({
      ref: r.ref,
      value: typeof r.value === 'bigint' ? { __bigint: r.value.toString() } : r.value,
      blockNumber: r.blockNumber.toString(),
    })),
  });
}

/**
 * Deserialize DataRefContext from transmission format
 */
export function deserializeDataRefContext(data: string): DataRefContext {
  const parsed = JSON.parse(data);
  return {
    chainBlocks: Object.fromEntries(
      Object.entries(parsed.chainBlocks).map(([k, v]) => [k, BigInt(v as string)])
    ),
    resolvedRefs: parsed.resolvedRefs.map((r: any) => ({
      ref: r.ref,
      value: r.value?.__bigint ? BigInt(r.value.__bigint) : r.value,
      blockNumber: BigInt(r.blockNumber),
    })),
  };
}

/**
 * Resolves data references in step arguments by making on-chain calls.
 * 
 * Supports two modes for Othentic consensus:
 * 1. Leader mode (no context): fetches current block and creates new context
 * 2. Operator mode (with context): uses provided block numbers for deterministic replay
 */
export class DataRefResolver {
  private clientCache: Map<number, PublicClient> = new Map();
  private logger: Logger;
  private ipfsServiceUrl: string;
  private accessToken?: string;
  
  /** Context for deterministic resolution - stores block numbers and resolved values */
  private context: DataRefContext;
  
  /** If true, use existing context (operator mode). If false, create new context (leader mode) */
  private useExistingContext: boolean;

  /**
   * Create a DataRefResolver
   * @param ipfsServiceUrl - URL for chain config
   * @param accessToken - Optional auth token for RPC
   * @param existingContext - If provided, operate in "operator mode" using these block numbers
   * @param logger - Logger instance
   */
  constructor(
    ipfsServiceUrl: string, 
    accessToken?: string, 
    existingContext?: DataRefContext,
    logger: Logger = getDefaultLogger()
  ) {
    this.ipfsServiceUrl = ipfsServiceUrl;
    this.accessToken = accessToken;
    this.logger = logger;
    this.useExistingContext = !!existingContext;
    this.context = existingContext ?? { chainBlocks: {}, resolvedRefs: [] };
  }

  /**
   * Get the resolution context (for passing to operators)
   */
  getContext(): DataRefContext {
    return this.context;
  }

  /**
   * Get or create a public client for a chain
   */
  private getClient(chainId: number): PublicClient {
    let client = this.clientCache.get(chainId);
    if (!client) {
      const chainConfig = getChainConfig(this.ipfsServiceUrl);
      const config = chainConfig[chainId];
      if (!config) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }
      client = createPublicClient({
        transport: http(config.rpcUrl, authHttpConfig(this.accessToken)),
        chain: config.chain,
      }) as PublicClient;
      this.clientCache.set(chainId, client);
    }
    return client;
  }

  /**
   * Get block number for a chain - either from context or fetch current
   */
  private async getBlockNumber(chainId: number): Promise<bigint> {
    // If we have an existing context with this chain's block, use it (operator mode)
    if (this.useExistingContext && this.context.chainBlocks[chainId] !== undefined) {
      return this.context.chainBlocks[chainId];
    }
    
    // Leader mode: fetch current block and store it
    const client = this.getClient(chainId);
    const blockNumber = await client.getBlockNumber();
    this.context.chainBlocks[chainId] = blockNumber;
    this.logger.info(`Fixed block number for chain ${chainId}: ${blockNumber}`);
    return blockNumber;
  }

  /**
   * Resolve a single DataRef by making an on-chain read call at a specific block
   */
  async resolveRef(ref: DataRef): Promise<ResolvedDataRef> {
    const blockNumber = await this.getBlockNumber(ref.chainId);
    this.logger.info(`Resolving DataRef: ${ref.target}.${ref.abi} on chain ${ref.chainId} at block ${blockNumber}`);
    
    const client = this.getClient(ref.chainId);
    
    // Ensure ABI has returns clause for parsing
    const abiSignature = ref.abi.includes('returns') 
      ? ref.abi 
      : `${ref.abi} view returns (uint256)`; // Default fallback
    
    const abiItem = parseAbiItem(`function ${abiSignature}`) as AbiFunction;
    
    try {
      // Read at specific block for determinism!
      const result = await client.readContract({
        address: ref.target,
        abi: [abiItem],
        functionName: abiItem.name,
        args: ref.args as any,
        blockNumber: blockNumber,
      });
      
      // Handle multi-value returns
      let value: any;
      if (Array.isArray(result) && ref.resultIndex !== undefined) {
        value = result[ref.resultIndex];
        this.logger.info(`Resolved DataRef result[${ref.resultIndex}]: ${value} at block ${blockNumber}`);
      } else {
        value = result;
        this.logger.info(`Resolved DataRef result: ${result} at block ${blockNumber}`);
      }
      
      const resolved: ResolvedDataRef = { ref, value, blockNumber };
      this.context.resolvedRefs.push(resolved);
      return resolved;
    } catch (error) {
      this.logger.error(`Failed to resolve DataRef at block ${blockNumber}:`, error);
      throw new Error(`DataRef resolution failed for ${ref.target}.${ref.abi} at block ${blockNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve a single argument value - if it's a DataRef, resolve it; otherwise return as-is
   */
  async resolveArg(arg: any): Promise<any> {
    // Handle data reference strings
    if (isDataRefString(arg)) {
      const ref = parseDataRef(arg);
      const resolved = await this.resolveRef(ref);
      return resolved.value;
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
   * Resolve all data references in an array of arguments
   */
  async resolveArgs(args: readonly any[]): Promise<any[]> {
    return Promise.all(args.map(arg => this.resolveArg(arg)));
  }

  /**
   * Check if any arguments contain data references
   */
  static hasDataRefs(args: readonly any[]): boolean {
    const check = (value: any): boolean => {
      if (isDataRefString(value)) return true;
      if (Array.isArray(value)) return value.some(check);
      if (value !== null && typeof value === 'object') {
        return Object.values(value).some(check);
      }
      return false;
    };
    return args.some(check);
  }
}

