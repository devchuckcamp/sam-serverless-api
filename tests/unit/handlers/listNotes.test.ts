import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/listNotes';
import * as notesService from '../../../src/services/notes.service';
import { ForbiddenError } from '../../../src/lib/errors';
import { createMockJWTClaims } from '../../fixtures/auth';
import { createMockNoteDTO } from '../../fixtures/notes';

// Mock dependencies
jest.mock('../../../src/services/notes.service');
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

const mockedNotesService = notesService as jest.Mocked<typeof notesService>;

describe('listNotes handler', () => {
  function createMockEvent(
    pathParams?: Record<string, string>,
    queryParams?: Record<string, string>,
    claims?: Record<string, unknown>
  ): APIGatewayProxyEventV2WithJWTAuthorizer {
    const jwtClaims = claims ?? createMockJWTClaims();
    return {
      headers: {},
      pathParameters: pathParams ?? { patientId: 'patient-123' },
      queryStringParameters: queryParams ?? null,
      body: null,
      requestContext: {
        authorizer: {
          jwt: {
            claims: jwtClaims as Record<string, unknown>,
          },
        },
        http: {
          method: 'GET',
          path: '/patients/patient-123/notes',
        },
      },
      isBase64Encoded: false,
      rawPath: '/patients/patient-123/notes',
      rawQueryString: '',
      routeKey: 'GET /patients/{patientId}/notes',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list notes successfully with defaults', async () => {
    const mockNotes = [
      createMockNoteDTO({ noteId: 'note-1' }),
      createMockNoteDTO({ noteId: 'note-2' }),
    ];
    mockedNotesService.listNotes.mockResolvedValue({
      items: mockNotes,
      hasMore: false,
    });

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.items).toHaveLength(2);
    expect(responseBody.data.hasMore).toBe(false);
  });

  it('should list notes with pagination', async () => {
    const mockNotes = [createMockNoteDTO({ noteId: 'note-1' })];
    mockedNotesService.listNotes.mockResolvedValue({
      items: mockNotes,
      nextCursor: 'cursor-abc',
      hasMore: true,
    });

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.nextCursor).toBe('cursor-abc');
    expect(responseBody.data.hasMore).toBe(true);
  });

  it('should pass query parameters to service', async () => {
    mockedNotesService.listNotes.mockResolvedValue({
      items: [],
      hasMore: false,
    });

    const queryParams = {
      limit: '50',
      cursor: 'cursor-xyz',
      studyDateFrom: '2024-01-01',
      studyDateTo: '2024-12-31',
      tag: 'sleep',
      q: 'apnea',
    };

    await handler(createMockEvent(undefined, queryParams));

    expect(mockedNotesService.listNotes).toHaveBeenCalledWith(
      expect.anything(),
      'patient-123',
      expect.objectContaining({
        limit: 50,
        cursor: 'cursor-xyz',
        studyDateFrom: '2024-01-01',
        studyDateTo: '2024-12-31',
        tag: 'sleep',
        q: 'apnea',
      })
    );
  });

  it('should use default limit of 20', async () => {
    mockedNotesService.listNotes.mockResolvedValue({
      items: [],
      hasMore: false,
    });

    await handler(createMockEvent());

    expect(mockedNotesService.listNotes).toHaveBeenCalledWith(
      expect.anything(),
      'patient-123',
      expect.objectContaining({
        limit: 20,
      })
    );
  });

  it('should return 400 when patientId is missing', async () => {
    const result = await handler(createMockEvent({}));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when limit exceeds 100', async () => {
    const result = await handler(createMockEvent(undefined, { limit: '150' }));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when limit is less than 1', async () => {
    const result = await handler(createMockEvent(undefined, { limit: '0' }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when studyDateFrom has invalid format', async () => {
    const result = await handler(createMockEvent(undefined, { studyDateFrom: '01/15/2024' }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when studyDateTo has invalid format', async () => {
    const result = await handler(createMockEvent(undefined, { studyDateTo: '2024-1-15' }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 401 when JWT claims are missing', async () => {
    const event = createMockEvent();
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    mockedNotesService.listNotes.mockRejectedValue(
      new ForbiddenError('Missing required permission')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(403);
  });

  it('should include correlation ID in response headers', async () => {
    mockedNotesService.listNotes.mockResolvedValue({
      items: [],
      hasMore: false,
    });

    const event = createMockEvent();
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should return empty array when no notes found', async () => {
    mockedNotesService.listNotes.mockResolvedValue({
      items: [],
      hasMore: false,
    });

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.items).toHaveLength(0);
  });

  it('should handle null query parameters', async () => {
    mockedNotesService.listNotes.mockResolvedValue({
      items: [],
      hasMore: false,
    });

    const event = createMockEvent();
    event.queryStringParameters = undefined;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });
});
