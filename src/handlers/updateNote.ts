import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../lib/correlation';
import { ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { success, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as notesService from '../services/notes.service';
import { updateNoteSchema, notePathParametersSchema } from '../types/schemas';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  const correlationId = extractOrCreateCorrelationId(event);

  try {
    const auth = extractAuthContext(event);

    const pathParams = notePathParametersSchema.parse(event.pathParameters);
    const { patientId, noteId } = pathParams;

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: unknown = JSON.parse(event.body);
    const input = updateNoteSchema.parse(body);

    logger.info('UpdateNote handler invoked', {
      patientId,
      noteId,
      expectedVersion: input.version,
    });

    const result = await notesService.updateNote(auth, patientId, noteId, input);

    return success(result, getCorrelationIdHeader(correlationId));
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
