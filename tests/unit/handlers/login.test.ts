import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Declare mock before imports due to jest.mock hoisting
const mockSend = jest.fn();

// Mock Cognito client - must be before handler import
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  AdminInitiateAuthCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

// Mock dependencies
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
    setCorrelationId: jest.fn(),
  },
}));
jest.mock('../../../src/lib/rate-limiter', () => ({
  enforceRateLimit: jest.fn().mockResolvedValue(undefined),
  enforceRateLimitByIp: jest.fn().mockResolvedValue(undefined),
}));

import { handler } from '../../../src/handlers/login';

describe('login handler', () => {
  function createMockEvent(body: unknown): APIGatewayProxyEventV2 {
    return {
      headers: {},
      body: body ? JSON.stringify(body) : null,
      requestContext: {
        http: {
          method: 'POST',
          path: '/auth/login',
        },
      },
      isBase64Encoded: false,
      rawPath: '/auth/login',
      rawQueryString: '',
      routeKey: 'POST /auth/login',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should login successfully', async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: {
        IdToken: 'id-token-abc',
        AccessToken: 'access-token-xyz',
        RefreshToken: 'refresh-token-123',
        ExpiresIn: 3600,
        TokenType: 'Bearer',
      },
    });

    const body = {
      username: 'testuser',
      password: 'password123',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.idToken).toBe('id-token-abc');
    expect(responseBody.data.accessToken).toBe('access-token-xyz');
    expect(responseBody.data.refreshToken).toBe('refresh-token-123');
    expect(responseBody.data.expiresIn).toBe(3600);
    expect(responseBody.data.tokenType).toBe('Bearer');
  });

  it('should return 400 when body is missing', async () => {
    const result = await handler(createMockEvent(null));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when username is missing', async () => {
    const body = {
      password: 'password123',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when password is missing', async () => {
    const body = {
      username: 'testuser',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 401 for invalid credentials (NotAuthorizedException)', async () => {
    const error = new Error('Incorrect username or password.');
    error.name = 'NotAuthorizedException';
    mockSend.mockRejectedValue(error);

    const body = {
      username: 'testuser',
      password: 'wrongpassword',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(401);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.message).toBe('Invalid username or password');
  });

  it('should return 401 for non-existent user (UserNotFoundException)', async () => {
    const error = new Error('User does not exist.');
    error.name = 'UserNotFoundException';
    mockSend.mockRejectedValue(error);

    const body = {
      username: 'nonexistent',
      password: 'password123',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(401);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.message).toBe('Invalid username or password');
  });

  it('should return 400 when challenge is required (NEW_PASSWORD_REQUIRED)', async () => {
    mockSend.mockResolvedValue({
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: 'session-token',
    });

    const body = {
      username: 'testuser',
      password: 'temppassword',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.message).toContain('NEW_PASSWORD_REQUIRED');
  });

  it('should return 401 when AuthenticationResult is null', async () => {
    mockSend.mockResolvedValue({});

    const body = {
      username: 'testuser',
      password: 'password123',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(401);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('UNAUTHORIZED');
  });

  it('should handle empty tokens gracefully', async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: {
        IdToken: '',
        AccessToken: '',
        RefreshToken: '',
        ExpiresIn: undefined,
        TokenType: undefined,
      },
    });

    const body = {
      username: 'testuser',
      password: 'password123',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.idToken).toBe('');
    expect(responseBody.data.expiresIn).toBe(3600); // default
    expect(responseBody.data.tokenType).toBe('Bearer'); // default
  });

  it('should handle unexpected errors', async () => {
    mockSend.mockRejectedValue(new Error('Internal Cognito error'));

    const body = {
      username: 'testuser',
      password: 'password123',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(500);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should handle MFA challenge', async () => {
    mockSend.mockResolvedValue({
      ChallengeName: 'SMS_MFA',
      Session: 'session-token',
    });

    const body = {
      username: 'testuser',
      password: 'password123',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.message).toContain('SMS_MFA');
  });
});
