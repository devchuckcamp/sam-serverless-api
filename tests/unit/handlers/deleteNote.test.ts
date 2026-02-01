import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/deleteNote';
import * as notesService from '../../../src/services/notes.service';
import { NotFoundError, ForbiddenError } from '../../../src/lib/errors';
import { createMockJWTClaims } from '../../fixtures/auth';

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

describe('deleteNote handler', () => {
  const validNoteId = '550e8400-e29b-41d4-a716-446655440000';

  function createMockEvent(
    pathParams?: Record<string, string>,
    claims?: Record<string, unknown>
  ): APIGatewayProxyEventV2WithJWTAuthorizer {
    const jwtClaims = claims ?? createMockJWTClaims({ 'cognito:groups': ['admin'] });
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
          method: 'DELETE',
          path: `/patients/patient-123/notes/${validNoteId}`,
        },
      },
      isBase64Encoded: false,
      rawPath: `/patients/patient-123/notes/${validNoteId}`,
      rawQueryString: '',
      routeKey: 'DELETE /patients/{patientId}/notes/{noteId}',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a note successfully', async () => {
    mockedNotesService.deleteNote.mockResolvedValue(undefined);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(204);
    expect(result.body).toBeUndefined();
  });

  it('should return 404 when note not found', async () => {
    mockedNotesService.deleteNote.mockRejectedValue(
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

  it('should return 403 when user lacks NOTES_DELETE permission', async () => {
    mockedNotesService.deleteNote.mockRejectedValue(
      new ForbiddenError('Missing required permission: notes:delete')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(403);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('FORBIDDEN');
  });

  it('should return 403 when patient not accessible', async () => {
    mockedNotesService.deleteNote.mockRejectedValue(
      new ForbiddenError('Patient not found or access denied')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(403);
  });

  it('should call service with correct parameters', async () => {
    mockedNotesService.deleteNote.mockResolvedValue(undefined);

    await handler(createMockEvent({ patientId: 'patient-xyz', noteId: validNoteId }));

    expect(mockedNotesService.deleteNote).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      }),
      'patient-xyz',
      validNoteId
    );
  });

  it('should handle unexpected errors', async () => {
    mockedNotesService.deleteNote.mockRejectedValue(
      new Error('Database connection failed')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(500);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('INTERNAL_ERROR');
  });
});
