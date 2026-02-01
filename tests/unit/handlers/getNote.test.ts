import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/getNote';
import * as notesService from '../../../src/services/notes.service';
import { NotFoundError, ForbiddenError } from '../../../src/lib/errors';
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

describe('getNote handler', () => {
  const validNoteId = '550e8400-e29b-41d4-a716-446655440000';

  function createMockEvent(
    pathParams?: Record<string, string>,
    claims?: Record<string, unknown>
  ): APIGatewayProxyEventV2WithJWTAuthorizer {
    const jwtClaims = claims ?? createMockJWTClaims();
    return {
      headers: {},
      pathParameters: pathParams ?? { patientId: 'patient-123', noteId: validNoteId },
      body: null,
      requestContext: {
        authorizer: {
          jwt: {
            claims: jwtClaims as Record<string, unknown>,
          },
        },
        http: {
          method: 'GET',
          path: `/patients/patient-123/notes/${validNoteId}`,
        },
      },
      isBase64Encoded: false,
      rawPath: `/patients/patient-123/notes/${validNoteId}`,
      rawQueryString: '',
      routeKey: 'GET /patients/{patientId}/notes/{noteId}',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get a note successfully', async () => {
    const mockNoteDTO = createMockNoteDTO({ noteId: validNoteId });
    mockedNotesService.getNote.mockResolvedValue(mockNoteDTO);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.noteId).toBe(validNoteId);
  });

  it('should return 404 when note not found', async () => {
    mockedNotesService.getNote.mockRejectedValue(
      new NotFoundError('Note', validNoteId)
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('NOT_FOUND');
  });

  it('should return 400 when noteId is invalid UUID', async () => {
    const result = await handler(createMockEvent({ patientId: 'patient-123', noteId: 'not-a-uuid' }));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when patientId is missing', async () => {
    const result = await handler(createMockEvent({ noteId: validNoteId }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when noteId is missing', async () => {
    const result = await handler(createMockEvent({ patientId: 'patient-123' }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 401 when JWT claims are missing', async () => {
    const event = createMockEvent();
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    mockedNotesService.getNote.mockRejectedValue(
      new ForbiddenError('Missing required permission')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(403);
  });

  it('should include correlation ID in response headers', async () => {
    const mockNoteDTO = createMockNoteDTO();
    mockedNotesService.getNote.mockResolvedValue(mockNoteDTO);

    const event = createMockEvent();
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should pass correct parameters to service', async () => {
    const mockNoteDTO = createMockNoteDTO();
    mockedNotesService.getNote.mockResolvedValue(mockNoteDTO);

    await handler(createMockEvent({ patientId: 'patient-xyz', noteId: validNoteId }));

    expect(mockedNotesService.getNote).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      }),
      'patient-xyz',
      validNoteId
    );
  });

  it('should return complete note DTO', async () => {
    const mockNoteDTO = createMockNoteDTO({
      noteId: validNoteId,
      title: 'Test Note',
      content: 'Test content',
      studyDate: '2024-01-15',
      version: 1,
      tags: ['sleep'],
    });
    mockedNotesService.getNote.mockResolvedValue(mockNoteDTO);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data).toMatchObject({
      noteId: validNoteId,
      title: 'Test Note',
      content: 'Test content',
      studyDate: '2024-01-15',
      version: 1,
      tags: ['sleep'],
    });
  });
});
