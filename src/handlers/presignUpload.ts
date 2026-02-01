import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../lib/correlation';
import { ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { enforceRateLimit } from '../lib/rate-limiter';
import { RATE_LIMITS } from '../lib/rate-limit-config';
import { success, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as attachmentsService from '../services/attachments.service';
import { presignUploadSchema, notePathParametersSchema } from '../types/schemas';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  const correlationId = extractOrCreateCorrelationId(event);

  try {
    const auth = extractAuthContext(event);

    // Rate limit by clinic for presign operations
    await enforceRateLimit(auth.clinicId, RATE_LIMITS.presign);

    const pathParams = notePathParametersSchema.parse(event.pathParameters);
    const { patientId, noteId } = pathParams;

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: unknown = JSON.parse(event.body);
    const input = presignUploadSchema.parse(body);

    logger.info('PresignUpload handler invoked', {
      patientId,
      noteId,
      contentType: input.contentType,
    });

    const result = await attachmentsService.generatePresignedUploadUrl(
      auth,
      patientId,
      noteId,
      input
    );

    return success(result, getCorrelationIdHeader(correlationId));
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
