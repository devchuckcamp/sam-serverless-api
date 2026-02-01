import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/listPatients';
import * as patientsService from '../../../src/services/patients.service';
import { ForbiddenError } from '../../../src/lib/errors';
import { createMockJWTClaims } from '../../fixtures/auth';

// Mock dependencies
jest.mock('../../../src/services/patients.service');
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

const mockedPatientsService = patientsService as jest.Mocked<typeof patientsService>;

describe('listPatients handler', () => {
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
          path: '/patients',
        },
      },
      isBase64Encoded: false,
      rawPath: '/patients',
      rawQueryString: '',
      routeKey: 'GET /patients',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list patients successfully', async () => {
    const mockPatients: patientsService.PatientDTO[] = [
      {
        patientId: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
      },
      {
        patientId: 'patient-2',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'active',
      },
    ];
    mockedPatientsService.listPatients.mockResolvedValue(mockPatients);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.items).toHaveLength(2);
    expect(responseBody.data.items[0].patientId).toBe('patient-1');
    expect(responseBody.data.items[1].patientId).toBe('patient-2');
  });

  it('should return empty array when no patients', async () => {
    mockedPatientsService.listPatients.mockResolvedValue([]);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.items).toHaveLength(0);
  });

  it('should return 401 when JWT claims are missing', async () => {
    const event = createMockEvent();
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    mockedPatientsService.listPatients.mockRejectedValue(
      new ForbiddenError('Missing required permission')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(403);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('FORBIDDEN');
  });

  it('should include correlation ID in response headers', async () => {
    mockedPatientsService.listPatients.mockResolvedValue([]);

    const event = createMockEvent();
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should pass auth context to service', async () => {
    mockedPatientsService.listPatients.mockResolvedValue([]);

    await handler(createMockEvent());

    expect(mockedPatientsService.listPatients).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      })
    );
  });

  it('should handle unexpected errors', async () => {
    mockedPatientsService.listPatients.mockRejectedValue(
      new Error('Database connection failed')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(500);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });

  it('should return patients with all fields', async () => {
    const mockPatients: patientsService.PatientDTO[] = [
      {
        patientId: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1980-05-15',
        gender: 'male',
        email: 'john@example.com',
        phone: '555-1234',
        status: 'active',
      },
    ];
    mockedPatientsService.listPatients.mockResolvedValue(mockPatients);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    const patient = responseBody.data.items[0];
    expect(patient.firstName).toBe('John');
    expect(patient.lastName).toBe('Doe');
    expect(patient.dateOfBirth).toBe('1980-05-15');
    expect(patient.gender).toBe('male');
    expect(patient.email).toBe('john@example.com');
    expect(patient.phone).toBe('555-1234');
  });
});
