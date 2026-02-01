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

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

function calculateSecretHash(username: string): string {
  const hmac = createHmac('sha256', CLIENT_SECRET);
  hmac.update(username + CLIENT_ID);
  return hmac.digest('base64');
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<ApiGatewayProxyStructuredResult> {
  extractOrCreateCorrelationId(event);

  try {
    // Rate limit by IP for login endpoint (unauthenticated)
    await enforceRateLimitByIp(event.requestContext?.http?.sourceIp, RATE_LIMITS.login);

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: LoginRequest = JSON.parse(event.body);

    if (!body.username || !body.password) {
      throw new ValidationError('Username and password are required');
    }

    logger.info('Login attempt', { username: body.username });

    const secretHash = calculateSecretHash(body.username);

    const command = new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: body.username,
        PASSWORD: body.password,
        SECRET_HASH: secretHash,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      // Handle challenges like NEW_PASSWORD_REQUIRED
      if (response.ChallengeName) {
        logger.info('Authentication challenge required', {
          challenge: response.ChallengeName,
        });
        throw new ValidationError(`Authentication challenge required: ${response.ChallengeName}`);
      }
      throw new UnauthorizedError('Authentication failed');
    }

    const result: LoginResponse = {
      idToken: response.AuthenticationResult.IdToken || '',
      accessToken: response.AuthenticationResult.AccessToken || '',
      refreshToken: response.AuthenticationResult.RefreshToken || '',
      expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
      tokenType: response.AuthenticationResult.TokenType || 'Bearer',
    };

    logger.info('Login successful', { username: body.username });

    return success(result);
  } catch (error) {
    const err = error as Error;

    if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
      logger.warn('Invalid credentials', { error: err.message });
      return handleError(new UnauthorizedError('Invalid username or password'));
    }

    return handleError(error);
  }
}
