import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../lib/correlation';
import { logger } from '../lib/logger';
import { success, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as notesService from '../services/notes.service';
import { listNotesQuerySchema, pathParametersSchema } from '../types/schemas';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  const correlationId = extractOrCreateCorrelationId(event);

  try {
    const auth = extractAuthContext(event);

    const pathParams = pathParametersSchema.parse(event.pathParameters);
    const { patientId } = pathParams;

    const queryParams = listNotesQuerySchema.parse(event.queryStringParameters ?? {});

    logger.info('ListNotes handler invoked', {
      patientId,
      limit: queryParams.limit,
      cursor: queryParams.cursor ? '[present]' : undefined,
      studyDateFrom: queryParams.studyDateFrom,
      studyDateTo: queryParams.studyDateTo,
      tag: queryParams.tag,
      q: queryParams.q ? '[present]' : undefined,
    });

    const result = await notesService.listNotes(auth, patientId, queryParams);

    return success(result, getCorrelationIdHeader(correlationId));
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
