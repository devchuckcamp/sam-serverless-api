import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handler } from '../../../src/handlers/presignUpload';
import * as attachmentsService from '../../../src/services/attachments.service';
import { ForbiddenError, ValidationError } from '../../../src/lib/errors';
import { createMockJWTClaims } from '../../fixtures/auth';

// Mock dependencies
jest.mock('../../../src/services/attachments.service');
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

const mockedAttachmentsService = attachmentsService as jest.Mocked<typeof attachmentsService>;

describe('presignUpload handler', () => {
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
          method: 'POST',
          path: `/patients/patient-123/notes/${validNoteId}/attachments/presign`,
        },
      },
      isBase64Encoded: false,
      rawPath: `/patients/patient-123/notes/${validNoteId}/attachments/presign`,
      rawQueryString: '',
      routeKey: 'POST /patients/{patientId}/notes/{noteId}/attachments/presign',
      version: '2.0',
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate presigned upload URL successfully', async () => {
    const mockResponse = {
      uploadUrl: 'https://s3.amazonaws.com/presigned-url',
      s3Key: 'clinic/clinic-abc/patient/patient-123/note/note-456/attach-id/file.pdf',
      attachmentId: 'attach-id',
      expiresIn: 900,
    };
    mockedAttachmentsService.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

    const body = {
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024 * 1024,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.data.uploadUrl).toBe('https://s3.amazonaws.com/presigned-url');
    expect(responseBody.data.attachmentId).toBe('attach-id');
    expect(responseBody.data.expiresIn).toBe(900);
  });

  it('should return 400 when body is missing', async () => {
    const result = await handler(createMockEvent(null));

    expect(result.statusCode).toBe(400);
    const responseBody = JSON.parse(result.body as string);
    expect(responseBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when fileName is missing', async () => {
    const body = {
      contentType: 'application/pdf',
      sizeBytes: 1024,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when contentType is missing', async () => {
    const body = {
      fileName: 'file.pdf',
      sizeBytes: 1024,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when sizeBytes is missing', async () => {
    const body = {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when sizeBytes exceeds limit', async () => {
    mockedAttachmentsService.generatePresignedUploadUrl.mockRejectedValue(
      new ValidationError('File size exceeds maximum allowed')
    );

    const body = {
      fileName: 'large.pdf',
      contentType: 'application/pdf',
      sizeBytes: 101 * 1024 * 1024, // 101MB
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when contentType is not allowed', async () => {
    mockedAttachmentsService.generatePresignedUploadUrl.mockRejectedValue(
      new ValidationError('Content type not allowed')
    );

    const body = {
      fileName: 'script.exe',
      contentType: 'application/x-msdownload',
      sizeBytes: 1024,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when noteId is invalid UUID', async () => {
    const body = {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    };

    const result = await handler(createMockEvent(body, { patientId: 'patient-123', noteId: 'invalid' }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when patientId is missing', async () => {
    const body = {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    };

    const result = await handler(createMockEvent(body, { noteId: validNoteId }));

    expect(result.statusCode).toBe(400);
  });

  it('should return 401 when JWT claims are missing', async () => {
    const body = {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    };

    const event = createMockEvent(body);
    event.requestContext.authorizer = undefined as unknown as typeof event.requestContext.authorizer;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    mockedAttachmentsService.generatePresignedUploadUrl.mockRejectedValue(
      new ForbiddenError('Missing required permission')
    );

    const body = {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    };

    const result = await handler(createMockEvent(body));

    expect(result.statusCode).toBe(403);
  });

  it('should include correlation ID in response headers', async () => {
    const mockResponse = {
      uploadUrl: 'https://s3.amazonaws.com/presigned-url',
      s3Key: 'path/to/file',
      attachmentId: 'attach-id',
      expiresIn: 900,
    };
    mockedAttachmentsService.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

    const body = {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    };

    const event = createMockEvent(body);
    event.headers['x-correlation-id'] = 'test-correlation-id';

    const result = await handler(event);

    expect(result.headers?.['x-correlation-id']).toBe('test-correlation-id');
  });

  it('should pass correct parameters to service', async () => {
    const mockResponse = {
      uploadUrl: 'https://s3.amazonaws.com/presigned-url',
      s3Key: 'path/to/file',
      attachmentId: 'attach-id',
      expiresIn: 900,
    };
    mockedAttachmentsService.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

    const body = {
      fileName: 'study.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    };

    await handler(createMockEvent(body, { patientId: 'patient-xyz', noteId: validNoteId }));

    expect(mockedAttachmentsService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      }),
      'patient-xyz',
      validNoteId,
      expect.objectContaining({
        fileName: 'study.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
      })
    );
  });
});
