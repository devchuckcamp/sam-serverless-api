import { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';
import { logger } from '../lib/logger';
import { success, error as handleError, ApiGatewayProxyStructuredResult } from '../lib/response';
import { extractOrCreateCorrelationId } from '../lib/correlation';
import { ValidationError, UnauthorizedError } from '../lib/errors';
import { enforceRateLimitByIp } from '../lib/rate-limiter';
import { RATE_LIMITS } from '../lib/rate-limit-config';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || '';

interface RefreshRequest {
  refreshToken: string;
  username: string;
}

function calculateSecretHash(username: string): string {
  const hmac = createHmac('sha256', CLIENT_SECRET);
  hmac.update(username + CLIENT_ID);
  return hmac.digest('base64');
}

interface RefreshResponse {
  idToken: string;
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<ApiGatewayProxyStructuredResult> {
  extractOrCreateCorrelationId(event);

  try {
    // Rate limit by IP for refresh endpoint (unauthenticated)
    await enforceRateLimitByIp(event.requestContext?.http?.sourceIp, RATE_LIMITS.login);

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: RefreshRequest = JSON.parse(event.body);

    if (!body.refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    if (!body.username) {
      throw new ValidationError('Username is required');
    }

    logger.info('Token refresh attempt', { username: body.username });

    const secretHash = calculateSecretHash(body.username);

    const command = new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: body.refreshToken,
        SECRET_HASH: secretHash,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      if (response.ChallengeName) {
        logger.info('Authentication challenge required', {
          challenge: response.ChallengeName,
        });
        throw new ValidationError(`Authentication challenge required: ${response.ChallengeName}`);
      }
      throw new UnauthorizedError('Token refresh failed');
    }

    const result: RefreshResponse = {
      idToken: response.AuthenticationResult.IdToken || '',
      accessToken: response.AuthenticationResult.AccessToken || '',
      expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      tokenType: response.AuthenticationResult.TokenType || 'Bearer',
    };

    logger.info('Token refresh successful');

    return success(result);
  } catch (error) {
    const err = error as Error;

    if (err.name === 'NotAuthorizedException') {
      logger.warn('Invalid or expired refresh token', { error: err.message });
      return handleError(new UnauthorizedError('Invalid or expired refresh token'));
    }

    return handleError(error);
  }
}
