import { Scope } from '../../../src/types/auth';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../src/lib/errors';
import * as attachmentsService from '../../../src/services/attachments.service';
import * as notesRepository from '../../../src/data/notes.repository';
import * as patientAccess from '../../../src/lib/patient-access';
import { createMockAuthContext, createReadOnlyAuthContext } from '../../fixtures/auth';
import { createMockNote, createMockAttachment } from '../../fixtures/notes';

// Mock dependencies
jest.mock('../../../src/data/notes.repository');
jest.mock('../../../src/lib/patient-access');
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-attachment-id'),
}));

// Mock S3 client and presigner
const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const mockedPatientAccess = patientAccess as jest.Mocked<typeof patientAccess>;
const mockedNotesRepository = notesRepository as jest.Mocked<typeof notesRepository>;

describe('attachmentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPatientAccess.assertPatientAccess.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue('https://s3.amazonaws.com/presigned-url');
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate a presigned upload URL', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024 * 1024, // 1MB
      };

      const result = await attachmentsService.generatePresignedUploadUrl(
        auth,
        'patient-123',
        'note-456',
        input
      );

      expect(result.uploadUrl).toBe('https://s3.amazonaws.com/presigned-url');
      expect(result.attachmentId).toBe('mock-attachment-id');
      expect(result.s3Key).toContain('clinic/clinic-abc/patient/patient-123/note/note-456');
      expect(result.expiresIn).toBe(900); // 15 minutes
    });

    it('should throw ForbiddenError when user lacks ATTACHMENTS_WRITE scope', async () => {
      const auth = createReadOnlyAuthContext();
      const input = {
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      };

      await expect(
        attachmentsService.generatePresignedUploadUrl(auth, 'patient-123', 'note-456', input)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when patient not accessible', async () => {
      const auth = createMockAuthContext();
      mockedPatientAccess.assertPatientAccess.mockRejectedValue(
        new ForbiddenError('Patient not found or access denied')
      );

      const input = {
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      };

      await expect(
        attachmentsService.generatePresignedUploadUrl(auth, 'patient-123', 'note-456', input)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError when file size exceeds limit', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        sizeBytes: 101 * 1024 * 1024, // 101MB
      };

      await expect(
        attachmentsService.generatePresignedUploadUrl(auth, 'patient-123', 'note-456', input)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for disallowed content type', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'script.exe',
        contentType: 'application/x-msdownload',
        sizeBytes: 1024,
      };

      await expect(
        attachmentsService.generatePresignedUploadUrl(auth, 'patient-123', 'note-456', input)
      ).rejects.toThrow(ValidationError);
    });

    it('should allow PDF content type', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      };

      const result = await attachmentsService.generatePresignedUploadUrl(
        auth,
        'patient-123',
        'note-456',
        input
      );

      expect(result.uploadUrl).toBeDefined();
    });

    it('should allow JPEG content type', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'image.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      };

      const result = await attachmentsService.generatePresignedUploadUrl(
        auth,
        'patient-123',
        'note-456',
        input
      );

      expect(result.uploadUrl).toBeDefined();
    });

    it('should allow PNG content type', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'image.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      };

      const result = await attachmentsService.generatePresignedUploadUrl(
        auth,
        'patient-123',
        'note-456',
        input
      );

      expect(result.uploadUrl).toBeDefined();
    });

    it('should allow DICOM content type', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'study.dcm',
        contentType: 'application/dicom',
        sizeBytes: 1024,
      };

      const result = await attachmentsService.generatePresignedUploadUrl(
        auth,
        'patient-123',
        'note-456',
        input
      );

      expect(result.uploadUrl).toBeDefined();
    });

    it('should sanitize file name in S3 key', async () => {
      const auth = createMockAuthContext();
      const input = {
        fileName: 'report with spaces & symbols!.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      };

      const result = await attachmentsService.generatePresignedUploadUrl(
        auth,
        'patient-123',
        'note-456',
        input
      );

      expect(result.s3Key).toContain('report_with_spaces___symbols_.pdf');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should generate a presigned download URL', async () => {
      const auth = createMockAuthContext();
      const attachment = createMockAttachment({
        id: 'attachment-123',
        fileName: 'study.pdf',
        contentType: 'application/pdf',
        s3Key: 'clinic/clinic-abc/patient/patient-123/note/note-456/attachment-123/study.pdf',
      });

      const note = createMockNote({
        noteId: 'note-456',
        attachments: [attachment],
      });

      mockedNotesRepository.findByIdWithoutStudyDate.mockResolvedValue(note);

      const result = await attachmentsService.generatePresignedDownloadUrl(
        auth,
        'patient-123',
        'note-456',
        'attachment-123'
      );

      expect(result.downloadUrl).toBe('https://s3.amazonaws.com/presigned-url');
      expect(result.fileName).toBe('study.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw ForbiddenError when user lacks NOTES_READ scope', async () => {
      const auth = createMockAuthContext({ scopes: [] });

      await expect(
        attachmentsService.generatePresignedDownloadUrl(auth, 'patient-123', 'note-456', 'attachment-123')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when patient not accessible', async () => {
      const auth = createMockAuthContext({ scopes: [Scope.NOTES_READ] });
      mockedPatientAccess.assertPatientAccess.mockRejectedValue(
        new ForbiddenError('Patient not found or access denied')
      );

      await expect(
        attachmentsService.generatePresignedDownloadUrl(auth, 'patient-123', 'note-456', 'attachment-123')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when note not found', async () => {
      const auth = createMockAuthContext();
      mockedNotesRepository.findByIdWithoutStudyDate.mockResolvedValue(null);

      await expect(
        attachmentsService.generatePresignedDownloadUrl(auth, 'patient-123', 'note-456', 'attachment-123')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when attachment not found in note', async () => {
      const auth = createMockAuthContext();
      const note = createMockNote({
        noteId: 'note-456',
        attachments: [],
      });

      mockedNotesRepository.findByIdWithoutStudyDate.mockResolvedValue(note);

      await expect(
        attachmentsService.generatePresignedDownloadUrl(auth, 'patient-123', 'note-456', 'nonexistent')
      ).rejects.toThrow(NotFoundError);
    });

    it('should find the correct attachment by ID', async () => {
      const auth = createMockAuthContext();
      const attachment1 = createMockAttachment({ id: 'attachment-1', fileName: 'file1.pdf' });
      const attachment2 = createMockAttachment({ id: 'attachment-2', fileName: 'file2.pdf' });

      const note = createMockNote({
        noteId: 'note-456',
        attachments: [attachment1, attachment2],
      });

      mockedNotesRepository.findByIdWithoutStudyDate.mockResolvedValue(note);

      const result = await attachmentsService.generatePresignedDownloadUrl(
        auth,
        'patient-123',
        'note-456',
        'attachment-2'
      );

      expect(result.fileName).toBe('file2.pdf');
    });

    it('should verify patient access is called with correct parameters', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-xyz' });
      const attachment = createMockAttachment({ id: 'attachment-123' });
      const note = createMockNote({ attachments: [attachment] });

      mockedNotesRepository.findByIdWithoutStudyDate.mockResolvedValue(note);

      await attachmentsService.generatePresignedDownloadUrl(
        auth,
        'patient-abc',
        'note-456',
        'attachment-123'
      );

      expect(mockedPatientAccess.assertPatientAccess).toHaveBeenCalledWith(auth, 'patient-abc');
    });
  });
});
