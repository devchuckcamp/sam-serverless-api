import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/createNote';
import * as notesService from '../../../src/services/notes.service';
import { ValidationError, ForbiddenError } from '../../../src/lib/errors';
import { createMockJWTClaims } from '../../fixtures/auth';
import { createMockNoteDTO } from '../../fixtures/notes';

// Mock dependencies
jest.mock('../../../src/services/notes.service');
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

const mockedNotesService = notesService as jest.Mocked<typeof notesService>;

describe('createNote handler', () => {
  function createMockEvent(
    body: unknown,
    pathParams?: Record<string, string>,
    claims?: Record<string, unknown>
  ): APIGatewayProxyEventV2WithJWTAuthorizer {
    const jwtClaims = claims ?? createMockJWTClaims();
    return {
      headers: {},
      pathParameters: pathParams ?? { patientId: 'patient-123' },
      body: body ? JSON.stringify(body) : null,
      requestContext: {
        authorizer: {
          jwt: {
            claims: jwtClaims as Record<string, unknown>,
          },
        },
        http: {
          method: 'POST',
          path: '/patients/patient-123/notes',
        },
      },
      isBase64Encoded: false,
      rawPath: '/patients/patient-123/notes',
      rawQueryString: '',
      routeKey: 'POST /patients/{patientId}/notes',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a note successfully', async () => {
    const mockNoteDTO = createMockNoteDTO();
    mockedNotesService.createNote.mockResolvedValue(mockNoteDTO);

    const body = {
      studyDate: '2024-01-15',
      title: 'Sleep Study Results',
      content: 'Patient shows moderate sleep apnea.',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(201);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.noteId).toBe(mockNoteDTO.noteId);
  });

  it('should return 400 when body is missing', async () => {
    const result = await handler(createMockEvent(null));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when body is invalid JSON', async () => {
    const event = createMockEvent({});
    event.body = 'invalid json';

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
  });

  it('should return 400 when studyDate is missing', async () => {
    const body = {
      title: 'Title',
      content: 'Content',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when studyDate format is invalid', async () => {
    const body = {
      studyDate: '01-15-2024',
      title: 'Title',
      content: 'Content',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when title is empty', async () => {
    const body = {
      studyDate: '2024-01-15',
      title: '',
      content: 'Content',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when patientId is missing', async () => {
    const body = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
    };

    const result = await handler(createMockEvent(body, {}));

    expect(result.statusCode).toBe(400);
  });

  it('should return 401 when JWT claims are missing', async () => {
    const body = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
    };

    const event = createMockEvent(body);
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    mockedNotesService.createNote.mockRejectedValue(
      new ForbiddenError('Missing required permission')
    );

    const body = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(403);
  });

  it('should include correlation ID in response headers', async () => {
    const mockNoteDTO = createMockNoteDTO();
    mockedNotesService.createNote.mockResolvedValue(mockNoteDTO);

    const body = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
    };

    const event = createMockEvent(body);
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should pass correct parameters to service', async () => {
    const mockNoteDTO = createMockNoteDTO();
    mockedNotesService.createNote.mockResolvedValue(mockNoteDTO);

    const body = {
      studyDate: '2024-01-15',
      title: 'Sleep Study',
      content: 'Results here',
      noteType: 'clinical',
      tags: ['sleep', 'apnea'],
    };

    await handler(createMockEvent(body, { patientId: 'patient-xyz' }));

    expect(mockedNotesService.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      }),
      'patient-xyz',
      expect.objectContaining({
        studyDate: '2024-01-15',
        title: 'Sleep Study',
        content: 'Results here',
        noteType: 'clinical',
        tags: ['sleep', 'apnea'],
      })
    );
  });

  it('should handle service throwing ValidationError', async () => {
    mockedNotesService.createNote.mockRejectedValue(
      new ValidationError('Invalid note data')
    );

    const body = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.message).toBe('Invalid note data');
  });
});
