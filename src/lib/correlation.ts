import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

const CORRELATION_HEADER = 'x-correlation-id';

export function extractOrCreateCorrelationId(event: APIGatewayProxyEventV2): string {
  const existingId = event.headers?.[CORRELATION_HEADER] || event.headers?.['X-Correlation-Id'];

  const correlationId = existingId || uuidv4();
  logger.setCorrelationId(correlationId);

  return correlationId;
}

export function getCorrelationIdHeader(correlationId: string): Record<string, string> {
  return { [CORRELATION_HEADER]: correlationId };
}
