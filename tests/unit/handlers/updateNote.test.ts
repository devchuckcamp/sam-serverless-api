import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/updateNote';
import * as notesService from '../../../src/services/notes.service';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../../src/lib/errors';
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

describe('updateNote handler', () => {
  const validNoteId = '550e8400-e29b-41d4-a716-446655440000';

  function createMockEvent(
    body: unknown,
    pathParams?: Record<string, string>,
    claims?: Record<string, unknown>
  ): APIGatewayProxyEventV2WithJWTAuthorizer {
    const jwtClaims = claims ?? createMockJWTClaims();
    return {
      headers: {},
      pathParameters: pathParams ?? { patientId: 'patient-123', noteId: validNoteId },
      body: body ? JSON.stringify(body) : null,
      requestContext: {
        authorizer: {
          jwt: {
            claims: jwtClaims as Record<string, unknown>,
          },
        },
        http: {
          method: 'PUT',
          path: `/patients/patient-123/notes/${validNoteId}`,
        },
      },
      isBase64Encoded: false,
      rawPath: `/patients/patient-123/notes/${validNoteId}`,
      rawQueryString: '',
      routeKey: 'PUT /patients/{patientId}/notes/{noteId}',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update a note successfully', async () => {
    const mockNoteDTO = createMockNoteDTO({
      noteId: validNoteId,
      title: 'Updated Title',
      version: 2,
    });
    mockedNotesService.updateNote.mockResolvedValue(mockNoteDTO);

    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.title).toBe('Updated Title');
    expect(responseBody.data.version).toBe(2);
  });

  it('should update title and content', async () => {
    const mockNoteDTO = createMockNoteDTO({
      title: 'New Title',
      content: 'New Content',
      version: 2,
    });
    mockedNotesService.updateNote.mockResolvedValue(mockNoteDTO);

    const body = {
      title: 'New Title',
      content: 'New Content',
      version: 1,
    };

    await handler(createMockEvent(body));

    expect(mockedNotesService.updateNote).toHaveBeenCalledWith(
      expect.anything(),
      'patient-123',
      validNoteId,
      expect.objectContaining({
        title: 'New Title',
        content: 'New Content',
        version: 1,
      })
    );
  });

  it('should return 400 when body is missing', async () => {
    const result = await handler(createMockEvent(null));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when version is missing', async () => {
    const body = {
      title: 'Updated Title',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when version is not positive', async () => {
    const body = {
      title: 'Updated Title',
      version: 0,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when noteId is invalid UUID', async () => {
    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const result = await handler(createMockEvent(body, { patientId: 'patient-123', noteId: 'invalid' }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when patientId is missing', async () => {
    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const result = await handler(createMockEvent(body, { noteId: validNoteId }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 404 when note not found', async () => {
    mockedNotesService.updateNote.mockRejectedValue(
      new NotFoundError('Note', validNoteId)
    );

    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(404);
  });

  it('should return 409 when version conflict', async () => {
    mockedNotesService.updateNote.mockRejectedValue(
      new ConflictError('Version conflict: expected 1, current is 2')
    );

    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(409);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('CONFLICT');
  });

  it('should return 401 when JWT claims are missing', async () => {
    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const event = createMockEvent(body);
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    mockedNotesService.updateNote.mockRejectedValue(
      new ForbiddenError('Missing required permission')
    );

    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(403);
  });

  it('should include correlation ID in response headers', async () => {
    const mockNoteDTO = createMockNoteDTO();
    mockedNotesService.updateNote.mockResolvedValue(mockNoteDTO);

    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const event = createMockEvent(body);
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should handle updating attachments', async () => {
    const mockNoteDTO = createMockNoteDTO();
    mockedNotesService.updateNote.mockResolvedValue(mockNoteDTO);

    const body = {
      version: 1,
      attachments: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          fileName: 'file.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
          s3Key: 'path/to/file.pdf',
          uploadedAt: '2024-01-15T10:00:00.000Z',
        },
      ],
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(200);
    expect(mockedNotesService.updateNote).toHaveBeenCalledWith(
      expect.anything(),
      'patient-123',
      validNoteId,
      expect.objectContaining({
        attachments: body.attachments,
      })
    );
  });

  it('should handle service throwing ValidationError', async () => {
    mockedNotesService.updateNote.mockRejectedValue(
      new ValidationError('Invalid attachment data')
    );

    const body = {
      title: 'Updated Title',
      version: 1,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });
});
