import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../lib/correlation';
import { logger } from '../lib/logger';
import { success, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as attachmentsService from '../services/attachments.service';
import { attachmentPathParametersSchema } from '../types/schemas';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  const correlationId = extractOrCreateCorrelationId(event);

  try {
    const auth = extractAuthContext(event);

    const pathParams = attachmentPathParametersSchema.parse(event.pathParameters);
    const { patientId, noteId, attachmentId } = pathParams;

    logger.info('PresignDownload handler invoked', {
      patientId,
      noteId,
      attachmentId,
    });

    const result = await attachmentsService.generatePresignedDownloadUrl(
      auth,
      patientId,
      noteId,
      attachmentId
    );

    return success(result, getCorrelationIdHeader(correlationId));
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
