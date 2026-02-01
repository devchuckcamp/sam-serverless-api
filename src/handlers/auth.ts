import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { logger } from '../lib/logger';
import { success, error, ApiGatewayProxyStructuredResult } from '../lib/response';
import { ValidationError } from '../lib/errors';

/**
 * Mock Auth Handler for Local Development
 *
 * This endpoint generates mock JWT tokens for testing the API locally.
 * It should NOT be deployed to production.
 *
 * POST /auth/token
 * Body: { "clinicId": "clinic-a", "role": "clinician" }
 *
 * GET /auth/token?clinicId=clinic-a&role=admin
 */

interface TokenRequest {
  clinicId?: string;
  role?: string;
  userId?: string;
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  clinicId: string;
  userId: string;
  role: string;
}

const USER_IDS: Record<string, string> = {
  'clinic-a': 'user-dr-smith',
  'clinic-b': 'user-dr-johnson',
  'clinic-c': 'user-dr-williams',
};

function base64UrlEncode(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateMockToken(clinicId: string, userId: string, role: string): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'local-dev-key',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    'custom:clinicId': clinicId,
    'cognito:groups': [role],
    scope: 'notes:read notes:write notes:delete attachments:write',
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_local',
    aud: 'local-client-id',
    token_use: 'access',
    exp: now + 86400, // 24 hours
    iat: now,
  };

  const signature = 'local-dev-signature';
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.${signature}`;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<ApiGatewayProxyStructuredResult> {
  try {
    logger.info('Auth token request', { method: event.requestContext.http.method });

    let request: TokenRequest = {};

    // Handle both GET (query params) and POST (body)
    if (event.requestContext.http.method === 'POST' && event.body) {
      try {
        request = JSON.parse(event.body);
      } catch {
        throw new ValidationError('Invalid JSON body');
      }
    } else {
      request = {
        clinicId: event.queryStringParameters?.clinicId,
        role: event.queryStringParameters?.role,
        userId: event.queryStringParameters?.userId,
      };
    }

    const clinicId = request.clinicId || 'clinic-a';
    const role = request.role || 'clinician';
    const userId = request.userId || USER_IDS[clinicId] || `user-${clinicId}`;

    const accessToken = generateMockToken(clinicId, userId, role);

    const response: TokenResponse = {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 86400,
      clinicId,
      userId,
      role,
    };

    logger.info('Token generated', { clinicId, userId, role });

    return success(response);
  } catch (err) {
    logger.error('Auth error', err instanceof Error ? err : new Error(String(err)));
    return error(err);
  }
}
