import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/presignDownload';
import * as attachmentsService from '../../../src/services/attachments.service';
import { NotFoundError, ForbiddenError } from '../../../src/lib/errors';
import { createMockJWTClaims } from '../../fixtures/auth';

// Mock dependencies
jest.mock('../../../src/services/attachments.service');
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

const mockedAttachmentsService = attachmentsService as jest.Mocked<typeof attachmentsService>;

describe('presignDownload handler', () => {
  const validNoteId = '550e8400-e29b-41d4-a716-446655440000';
  const validAttachmentId = '550e8400-e29b-41d4-a716-446655440001';

  function createMockEvent(
    pathParams?: Record<string, string>,
    claims?: Record<string, unknown>
  ): APIGatewayProxyEventV2WithJWTAuthorizer {
    const jwtClaims = claims ?? createMockJWTClaims();
    return {
      headers: {},
      pathParameters: pathParams ?? {
        patientId: 'patient-123',
        noteId: validNoteId,
        attachmentId: validAttachmentId,
      },
      body: null,
      requestContext: {
        authorizer: {
          jwt: {
            claims: jwtClaims as Record<string, unknown>,
          },
        },
        http: {
          method: 'GET',
          path: `/patients/patient-123/notes/${validNoteId}/attachments/${validAttachmentId}/presign`,
        },
      },
      isBase64Encoded: false,
      rawPath: `/patients/patient-123/notes/${validNoteId}/attachments/${validAttachmentId}/presign`,
      rawQueryString: '',
      routeKey: 'GET /patients/{patientId}/notes/{noteId}/attachments/{attachmentId}/presign',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate presigned download URL successfully', async () => {
    const mockResponse = {
      downloadUrl: 'https://s3.amazonaws.com/presigned-download-url',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      expiresIn: 900,
    };
    mockedAttachmentsService.generatePresignedDownloadUrl.mockResolvedValue(mockResponse);

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.downloadUrl).toBe('https://s3.amazonaws.com/presigned-download-url');
    expect(responseBody.data.fileName).toBe('report.pdf');
    expect(responseBody.data.contentType).toBe('application/pdf');
    expect(responseBody.data.expiresIn).toBe(900);
  });

  it('should return 404 when note not found', async () => {
    mockedAttachmentsService.generatePresignedDownloadUrl.mockRejectedValue(
      new NotFoundError('Note', validNoteId)
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(404);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('NOT_FOUND');
  });

  it('should return 404 when attachment not found', async () => {
    mockedAttachmentsService.generatePresignedDownloadUrl.mockRejectedValue(
      new NotFoundError('Attachment', validAttachmentId)
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(404);
  });

  it('should return 400 when noteId is invalid UUID', async () => {
    const result = await handler(createMockEvent({
      patientId: 'patient-123',
      noteId: 'invalid',
      attachmentId: validAttachmentId,
    }));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when attachmentId is invalid UUID', async () => {
    const result = await handler(createMockEvent({
      patientId: 'patient-123',
      noteId: validNoteId,
      attachmentId: 'invalid',
    }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when patientId is missing', async () => {
    const result = await handler(createMockEvent({
      noteId: validNoteId,
      attachmentId: validAttachmentId,
    }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when noteId is missing', async () => {
    const result = await handler(createMockEvent({
      patientId: 'patient-123',
      attachmentId: validAttachmentId,
    }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when attachmentId is missing', async () => {
    const result = await handler(createMockEvent({
      patientId: 'patient-123',
      noteId: validNoteId,
    }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 401 when JWT claims are missing', async () => {
    const event = createMockEvent();
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    mockedAttachmentsService.generatePresignedDownloadUrl.mockRejectedValue(
      new ForbiddenError('Missing required permission')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(403);
  });

  it('should return 403 when patient not accessible', async () => {
    mockedAttachmentsService.generatePresignedDownloadUrl.mockRejectedValue(
      new ForbiddenError('Patient not found or access denied')
    );

    const result = await handler(createMockEvent());

    expect(result.statusCode).toBe(403);
  });

  it('should include correlation ID in response headers', async () => {
    const mockResponse = {
      downloadUrl: 'https://s3.amazonaws.com/presigned-url',
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      expiresIn: 900,
    };
    mockedAttachmentsService.generatePresignedDownloadUrl.mockResolvedValue(mockResponse);

    const event = createMockEvent();
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should pass correct parameters to service', async () => {
    const mockResponse = {
      downloadUrl: 'https://s3.amazonaws.com/presigned-url',
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      expiresIn: 900,
    };
    mockedAttachmentsService.generatePresignedDownloadUrl.mockResolvedValue(mockResponse);

    await handler(createMockEvent({
      patientId: 'patient-xyz',
      noteId: validNoteId,
      attachmentId: validAttachmentId,
    }));

    expect(mockedAttachmentsService.generatePresignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      }),
      'patient-xyz',
      validNoteId,
      validAttachmentId
    );
  });
});
