import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../lib/correlation';
import { logger } from '../lib/logger';
import { success, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as notesService from '../services/notes.service';
import { notePathParametersSchema } from '../types/schemas';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  const correlationId = extractOrCreateCorrelationId(event);

  try {
    const auth = extractAuthContext(event);

    const pathParams = notePathParametersSchema.parse(event.pathParameters);
    const { patientId, noteId } = pathParams;

    logger.info('GetNote handler invoked', { patientId, noteId });

    const result = await notesService.getNote(auth, patientId, noteId);

    return success(result, getCorrelationIdHeader(correlationId));
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
