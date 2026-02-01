import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../lib/correlation';
import { ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { enforceRateLimit } from '../lib/rate-limiter';
import { RATE_LIMITS } from '../lib/rate-limit-config';
import { created, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as notesService from '../services/notes.service';
import { createNoteSchema, pathParametersSchema } from '../types/schemas';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  const correlationId = extractOrCreateCorrelationId(event);

  try {
    const auth = extractAuthContext(event);

    // Rate limit by clinic for create operations
    await enforceRateLimit(auth.clinicId, RATE_LIMITS.createNote);

    const pathParams = pathParametersSchema.parse(event.pathParameters);
    const { patientId } = pathParams;

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: unknown = JSON.parse(event.body);
    const input = createNoteSchema.parse(body);

    logger.info('CreateNote handler invoked', { patientId });

    const result = await notesService.createNote(auth, patientId, input);

    return created(result, getCorrelationIdHeader(correlationId));
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
