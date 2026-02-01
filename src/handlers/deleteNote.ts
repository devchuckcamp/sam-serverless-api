import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { logger } from '../lib/logger';
import { noContent, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as notesService from '../services/notes.service';
import { notePathParametersSchema } from '../types/schemas';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  try {
    const auth = extractAuthContext(event);

    const pathParams = notePathParametersSchema.parse(event.pathParameters);
    const { patientId, noteId } = pathParams;

    logger.info('DeleteNote handler invoked', { patientId, noteId });

    await notesService.deleteNote(auth, patientId, noteId);

    return noContent();
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
