import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext } from '../lib/auth';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../lib/correlation';
import { logger } from '../lib/logger';
import { success, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import * as patientsService from '../services/patients.service';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<ApiGatewayProxyStructuredResult> {
  const correlationId = extractOrCreateCorrelationId(event);

  try {
    const auth = extractAuthContext(event);

    logger.info('ListPatients handler invoked', {
      clinicId: auth.clinicId,
    });

    const patients = await patientsService.listPatients(auth);

    return success({ items: patients }, getCorrelationIdHeader(correlationId));
  } catch (err) {
    return error(err);
  } finally {
    logger.clearContext();
  }
}
