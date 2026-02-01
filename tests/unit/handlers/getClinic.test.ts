import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/getClinic';
import * as clinicsService from '../../../src/services/clinics.service';
import { NotFoundError } from '../../../src/lib/errors';
import { createMockJWTClaims } from '../../fixtures/auth';

// Mock dependencies
jest.mock('../../../src/services/clinics.service');
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

const mockedClinicsService = clinicsService as jest.Mocked<typeof clinicsService>;

describe('getClinic handler', () => {
  function createMockEvent(
    claims?: Record<string, unknown>
  ): APIGatewayProxyEventV2WithJWTAuthorizer {
    const jwtClaims = claims ?? createMockJWTClaims();
    return {
      headers: {},
      pathParameters: {},
      body: null,
      requestContext: {
        authorizer: {
          jwt: {
            claims: jwtClaims as Record<string, unknown>,
          },
        },
        http: {
          method: 'GET',
          path: '/clinic',
        },
      },
      isBase64Encoded: false,
      rawPath: '/clinic',
      rawQueryString: '',
      routeKey: 'GET /clinic',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get clinic successfully', async () => {
    const mockClinic: clinicsService.ClinicDTO = {
      clinicId: 'clinic-abc',
      name: 'Sleep Center Medical',
      address: '123 Medical Drive',
      phone: '555-1234',
      email: 'info@sleepcenter.com',
      timezone: 'America/New_York',
    };
    mockedClinicsService.getClinic.mockResolvedValue(mockClinic);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.clinicId).toBe('clinic-abc');
    expect(responseBody.data.name).toBe('Sleep Center Medical');
    expect(responseBody.data.address).toBe('123 Medical Drive');
    expect(responseBody.data.phone).toBe('555-1234');
    expect(responseBody.data.email).toBe('info@sleepcenter.com');
    expect(responseBody.data.timezone).toBe('America/New_York');
  });

  it('should return 404 when clinic not found', async () => {
    mockedClinicsService.getClinic.mockRejectedValue(
      new NotFoundError('Clinic', 'clinic-abc')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('NOT_FOUND');
  });

  it('should return 401 when JWT claims are missing', async () => {
    const event = createMockEvent();
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should include correlation ID in response headers', async () => {
    const mockClinic: clinicsService.ClinicDTO = {
      clinicId: 'clinic-abc',
      name: 'Test Clinic',
    };
    mockedClinicsService.getClinic.mockResolvedValue(mockClinic);

    const event = createMockEvent();
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should pass auth context to service', async () => {
    const mockClinic: clinicsService.ClinicDTO = {
      clinicId: 'clinic-abc',
      name: 'Test Clinic',
    };
    mockedClinicsService.getClinic.mockResolvedValue(mockClinic);

    await handler(createMockEvent());

    expect(mockedClinicsService.getClinic).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      })
    );
  });

  it('should handle unexpected errors', async () => {
    mockedClinicsService.getClinic.mockRejectedValue(
      new Error('Database connection failed')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(500);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should return clinic with minimal fields', async () => {
    const mockClinic: clinicsService.ClinicDTO = {
      clinicId: 'clinic-xyz',
      name: 'Minimal Clinic',
    };
    mockedClinicsService.getClinic.mockResolvedValue(mockClinic);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.clinicId).toBe('clinic-xyz');
    expect(responseBody.data.name).toBe('Minimal Clinic');
    expect(responseBody.data.address).toBeUndefined();
    expect(responseBody.data.phone).toBeUndefined();
  });
});
