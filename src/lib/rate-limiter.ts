import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../data/client';
import { TooManyRequestsError } from './errors';
import { logger } from './logger';
import type { RateLimitConfig } from './rate-limit-config';

/**
 * Builds the partition key for rate limit records.
 * Uses a separate key pattern to avoid conflicts with other data.
 */
function buildRateLimitPK(identifier: string, configName: string): string {
  return `RATELIMIT#${configName}#${identifier}`;
}

/**
 * Builds the sort key for rate limit records based on time window.
 */
function buildRateLimitSK(windowSeconds: number): string {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  return `WINDOW#${windowStart}`;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  retryAfter: number;
}

/**
 * Checks the current rate limit status without incrementing the counter.
 * Useful for informational purposes.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const pk = buildRateLimitPK(identifier, config.name);
  const sk = buildRateLimitSK(config.windowSeconds);

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        ProjectionExpression: '#count',
        ExpressionAttributeNames: { '#count': 'count' },
      })
    );

    const current = (result.Item?.count as number) ?? 0;
    const windowStart = Math.floor(Date.now() / 1000 / config.windowSeconds) * config.windowSeconds;
    const windowEnd = windowStart + config.windowSeconds;
    const retryAfter = Math.max(1, windowEnd - Math.floor(Date.now() / 1000));

    return {
      allowed: current < config.maxRequests,
      current,
      limit: config.maxRequests,
      retryAfter,
    };
  } catch (error) {
    logger.warn('Rate limit check failed, allowing request (fail-open)', {
      identifier,
      config: config.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      allowed: true,
      current: 0,
      limit: config.maxRequests,
      retryAfter: config.windowSeconds,
    };
  }
}

/**
 * Increments the rate limit counter and checks if the request is allowed.
 * Uses atomic increment to handle concurrent requests safely.
 * Implements fail-open: if DynamoDB errors, the request is allowed.
 */
export async function incrementRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const pk = buildRateLimitPK(identifier, config.name);
  const sk = buildRateLimitSK(config.windowSeconds);
  const windowStart = Math.floor(Date.now() / 1000 / config.windowSeconds) * config.windowSeconds;
  const ttl = windowStart + config.windowSeconds + 60; // Keep for 1 minute after window expires

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#count': 'count',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': 1,
          ':ttl': ttl,
        },
        ReturnValues: 'UPDATED_NEW',
      })
    );

    const current = (result.Attributes?.count as number) ?? 1;
    const windowEnd = windowStart + config.windowSeconds;
    const retryAfter = Math.max(1, windowEnd - Math.floor(Date.now() / 1000));

    return {
      allowed: current <= config.maxRequests,
      current,
      limit: config.maxRequests,
      retryAfter,
    };
  } catch (error) {
    logger.warn('Rate limit increment failed, allowing request (fail-open)', {
      identifier,
      config: config.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      allowed: true,
      current: 0,
      limit: config.maxRequests,
      retryAfter: config.windowSeconds,
    };
  }
}

/**
 * Enforces rate limiting by incrementing the counter and throwing if exceeded.
 * This is the primary function to use in handlers.
 *
 * @param identifier - The entity to rate limit (typically clinicId)
 * @param config - Rate limit configuration from RATE_LIMITS
 * @throws TooManyRequestsError if rate limit is exceeded
 */
export async function enforceRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<void> {
  const result = await incrementRateLimit(identifier, config);

  if (!result.allowed) {
    logger.warn('Rate limit exceeded', {
      identifier,
      config: config.name,
      current: result.current,
      limit: result.limit,
    });
    throw new TooManyRequestsError(
      `Rate limit exceeded for ${config.name}. Please try again later.`,
      result.retryAfter
    );
  }

  logger.debug('Rate limit check passed', {
    identifier,
    config: config.name,
    current: result.current,
    limit: result.limit,
  });
}

/**
 * Enforces rate limiting using IP address for unauthenticated endpoints.
 * Falls back to 'unknown' if IP cannot be extracted.
 *
 * @param sourceIp - The source IP address from the request
 * @param config - Rate limit configuration from RATE_LIMITS
 * @throws TooManyRequestsError if rate limit is exceeded
 */
export async function enforceRateLimitByIp(
  sourceIp: string | undefined,
  config: RateLimitConfig
): Promise<void> {
  const identifier = sourceIp ?? 'unknown';
  await enforceRateLimit(`IP#${identifier}`, config);
}
