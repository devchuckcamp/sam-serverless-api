import { ZodError } from 'zod';
import { isAppError, ValidationError, TooManyRequestsError } from './errors';
import { logger } from './logger';

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiGatewayProxyStructuredResult {
  statusCode: number;
  headers?: Record<string, string | boolean | number>;
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function createResponse<T>(
  statusCode: number,
  body: ApiResponse<T>,
  headers?: Record<string, string>
): ApiGatewayProxyStructuredResult {
  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...headers },
    body: JSON.stringify(body),
  };
}

export function success<T>(data: T, headers?: Record<string, string>): ApiGatewayProxyStructuredResult {
  return createResponse(200, { data }, headers);
}

export function created<T>(data: T, headers?: Record<string, string>): ApiGatewayProxyStructuredResult {
  return createResponse(201, { data }, headers);
}

export function noContent(): ApiGatewayProxyStructuredResult {
  return {
    statusCode: 204,
    headers: DEFAULT_HEADERS,
  };
}

export function error(err: unknown): ApiGatewayProxyStructuredResult {
  if (err instanceof ZodError) {
    const validationError = new ValidationError('Validation failed', err.errors);
    logger.warn('Validation error', { details: err.errors });
    return createResponse(400, {
      error: {
        code: validationError.code,
        message: validationError.message,
        details: validationError.details,
      },
    });
  }

  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error('Server error', err);
    } else {
      logger.warn('Client error', { code: err.code, message: err.message });
    }

    const response: ApiResponse<never> = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && err.details) {
      response.error!.details = err.details;
    }

    if (err instanceof TooManyRequestsError) {
      return createResponse(err.statusCode, response, {
        'Retry-After': String(err.retryAfter),
      });
    }

    return createResponse(err.statusCode, response);
  }

  logger.error('Unexpected error', err instanceof Error ? err : new Error(String(err)));

  return createResponse(500, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

export function redirect(location: string, statusCode: 301 | 302 = 302): ApiGatewayProxyStructuredResult {
  return {
    statusCode,
    headers: {
      ...DEFAULT_HEADERS,
      Location: location,
    },
  };
}
