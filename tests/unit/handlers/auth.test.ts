import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../../../src/handlers/auth';

// Mock dependencies
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
    setCorrelationId: jest.fn(),
  },
}));

describe('auth handler (mock token generator)', () => {
  function createMockEvent(
    method: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): APIGatewayProxyEventV2 {
    return {
      headers: {},
      body: body ? JSON.stringify(body) : null,
      queryStringParameters: queryParams ?? null,
      requestContext: {
        http: {
          method,
          path: '/auth/token',
        },
      },
      isBase64Encoded: false,
      rawPath: '/auth/token',
      rawQueryString: queryParams ? new URLSearchParams(queryParams).toString() : '',
      routeKey: `${method} /auth/token`,
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/token', () => {
    it('should generate token with provided clinicId and role', async () => {
      const body = {
        clinicId: 'clinic-xyz',
        role: 'admin',
      };

      const result = await handler(createMockEvent('POST', body));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.clinicId).toBe('clinic-xyz');
      expect(responseBody.data.role).toBe('admin');
      expect(responseBody.data.accessToken).toBeDefined();
      expect(responseBody.data.tokenType).toBe('Bearer');
      expect(responseBody.data.expiresIn).toBe(86400);
    });

    it('should generate token with default clinicId when not provided', async () => {
      const body = {
        role: 'clinician',
      };

      const result = await handler(createMockEvent('POST', body));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.clinicId).toBe('clinic-a');
      expect(responseBody.data.role).toBe('clinician');
    });

    it('should generate token with default role when not provided', async () => {
      const body = {
        clinicId: 'clinic-b',
      };

      const result = await handler(createMockEvent('POST', body));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.clinicId).toBe('clinic-b');
      expect(responseBody.data.role).toBe('clinician');
    });

    it('should generate token with default values when body is empty', async () => {
      const result = await handler(createMockEvent('POST', {}));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.clinicId).toBe('clinic-a');
      expect(responseBody.data.role).toBe('clinician');
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent('POST');
      event.body = 'invalid json';

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.error.code).toBe('VALIDATION_ERROR');
    });

    it('should use provided userId', async () => {
      const body = {
        clinicId: 'clinic-a',
        userId: 'custom-user-id',
      };

      const result = await handler(createMockEvent('POST', body));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.userId).toBe('custom-user-id');
    });

    it('should generate appropriate userId for clinic-a', async () => {
      const body = {
        clinicId: 'clinic-a',
      };

      const result = await handler(createMockEvent('POST', body));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.userId).toBe('user-dr-smith');
    });

    it('should generate appropriate userId for clinic-b', async () => {
      const body = {
        clinicId: 'clinic-b',
      };

      const result = await handler(createMockEvent('POST', body));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.userId).toBe('user-dr-johnson');
    });
  });

  describe('GET /auth/token', () => {
    it('should generate token from query parameters', async () => {
      const queryParams = {
        clinicId: 'clinic-xyz',
        role: 'admin',
      };

      const result = await handler(createMockEvent('GET', undefined, queryParams));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.clinicId).toBe('clinic-xyz');
      expect(responseBody.data.role).toBe('admin');
    });

    it('should use default values when no query params', async () => {
      const result = await handler(createMockEvent('GET'));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.clinicId).toBe('clinic-a');
      expect(responseBody.data.role).toBe('clinician');
    });

    it('should accept userId in query params', async () => {
      const queryParams = {
        clinicId: 'clinic-a',
        userId: 'custom-user',
      };

      const result = await handler(createMockEvent('GET', undefined, queryParams));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      expect(responseBody.data.userId).toBe('custom-user');
    });
  });

  describe('JWT token format', () => {
    it('should generate a valid JWT format token', async () => {
      const result = await handler(createMockEvent('POST', {}));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      const token = responseBody.data.accessToken;

      // JWT should have 3 parts separated by dots
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      // Decode header
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));
      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');

      // Decode payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      expect(payload.sub).toBeDefined();
      expect(payload['custom:clinicId']).toBeDefined();
      expect(payload['cognito:groups']).toBeInstanceOf(Array);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });

    it('should include correct claims in token', async () => {
      const body = {
        clinicId: 'clinic-test',
        role: 'doctor',
        userId: 'user-test',
      };

      const result = await handler(createMockEvent('POST', body));

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body as string);
      const token = responseBody.data.accessToken;
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));

      expect(payload.sub).toBe('user-test');
      expect(payload['custom:clinicId']).toBe('clinic-test');
      expect(payload['cognito:groups']).toContain('doctor');
    });
  });
});
