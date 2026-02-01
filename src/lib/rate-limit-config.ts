export interface RateLimitConfig {
  /** Maximum requests allowed in the time window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Identifier for logging and debugging */
  name: string;
}

/**
 * Rate limit configurations per endpoint type.
 * Values are tuned for healthcare workflows while preventing abuse.
 */
export const RATE_LIMITS = {
  /** Login endpoint - strict limit to prevent brute force attacks */
  login: {
    maxRequests: 10,
    windowSeconds: 60,
    name: 'login',
  } satisfies RateLimitConfig,

  /** Create note - moderate limit for typical clinical workflows */
  createNote: {
    maxRequests: 60,
    windowSeconds: 60,
    name: 'createNote',
  } satisfies RateLimitConfig,

  /** Read operations - higher limit as reads are less resource-intensive */
  read: {
    maxRequests: 200,
    windowSeconds: 60,
    name: 'read',
  } satisfies RateLimitConfig,

  /** Presigned URL generation - moderate limit to prevent abuse */
  presign: {
    maxRequests: 30,
    windowSeconds: 60,
    name: 'presign',
  } satisfies RateLimitConfig,

  /** Default limit for uncategorized endpoints */
  default: {
    maxRequests: 100,
    windowSeconds: 60,
    name: 'default',
  } satisfies RateLimitConfig,
} as const;
