import * as notesRepository from '../../../src/data/notes.repository';
import { ConflictError, NotFoundError } from '../../../src/lib/errors';
import { CreateNoteInput, UpdateNoteInput } from '../../../src/types';

// Mock the DynamoDB client
const mockSend = jest.fn();
jest.mock('../../../src/data/client', () => ({
  docClient: {
    send: (...args: unknown[]) => mockSend(...args),
  },
  TABLE_NAME: 'TestTable',
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-note-id-123'),
}));

// Mock logger
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

describe('notes.repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a note with all fields', async () => {
      mockSend.mockResolvedValue({});

      const input: CreateNoteInput = {
        studyDate: '2024-01-15',
        title: 'Sleep Study Results',
        content: 'Patient shows signs of moderate sleep apnea.',
        noteType: 'clinical',
        tags: ['sleep', 'apnea'],
        attachments: [],
      };

      const result = await notesRepository.create('clinic-abc', 'patient-123', 'user-456', 'Dr. Test', input);

      expect(result.noteId).toBe('mock-note-id-123');
      expect(result.clinicId).toBe('clinic-abc');
      expect(result.patientId).toBe('patient-123');
      expect(result.studyDate).toBe('2024-01-15');
      expect(result.title).toBe('Sleep Study Results');
      expect(result.content).toBe('Patient shows signs of moderate sleep apnea.');
      expect(result.noteType).toBe('clinical');
      expect(result.tags).toEqual(['sleep', 'apnea']);
      expect(result.createdBy).toBe('user-456');
      expect(result.updatedBy).toBe('user-456');
      expect(result.version).toBe(1);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create a note with minimal fields', async () => {
      mockSend.mockResolvedValue({});

      const input: CreateNoteInput = {
        studyDate: '2024-01-15',
        title: 'Note Title',
        content: 'Note content',
      };

      const result = await notesRepository.create('clinic-abc', 'patient-123', 'user-456', 'Dr. Test', input);

      expect(result.noteType).toBeUndefined();
      expect(result.tags).toEqual([]);
      expect(result.attachments).toEqual([]);
    });

    it('should use correct DynamoDB keys', async () => {
      mockSend.mockResolvedValue({});

      const input: CreateNoteInput = {
        studyDate: '2024-01-15',
        title: 'Title',
        content: 'Content',
      };

      await notesRepository.create('clinic-abc', 'patient-123', 'user-456', 'Dr. Test', input);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'TestTable',
            Item: expect.objectContaining({
              PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
              SK: 'NOTE#2024-01-15#mock-note-id-123',
              entityType: 'NOTE',
            }),
            ConditionExpression: 'attribute_not_exists(PK)',
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return a note when found', async () => {
      const mockItem = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id',
        noteId: 'note-id',
        clinicId: 'clinic-abc',
        patientId: 'patient-123',
        studyDate: '2024-01-15',
        title: 'Test Note',
        content: 'Test content',
        attachments: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        createdBy: 'user-123',
        updatedBy: 'user-123',
        version: 1,
        entityType: 'NOTE',
      };

      mockSend.mockResolvedValue({ Item: mockItem });

      const result = await notesRepository.findById('clinic-abc', 'patient-123', 'note-id', '2024-01-15');

      expect(result).not.toBeNull();
      expect(result?.noteId).toBe('note-id');
      expect(result?.title).toBe('Test Note');
    });

    it('should return null when note not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await notesRepository.findById('clinic-abc', 'patient-123', 'note-id', '2024-01-15');

      expect(result).toBeNull();
    });

    it('should return null when note is soft deleted', async () => {
      const mockItem = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id',
        noteId: 'note-id',
        clinicId: 'clinic-abc',
        patientId: 'patient-123',
        studyDate: '2024-01-15',
        title: 'Deleted Note',
        content: 'Content',
        attachments: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        createdBy: 'user-123',
        updatedBy: 'user-123',
        version: 1,
        entityType: 'NOTE',
        deletedAt: '2024-01-16T10:00:00.000Z',
        deletedBy: 'user-456',
      };

      mockSend.mockResolvedValue({ Item: mockItem });

      const result = await notesRepository.findById('clinic-abc', 'patient-123', 'note-id', '2024-01-15');

      expect(result).toBeNull();
    });

    it('should use correct key structure', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      await notesRepository.findById('clinic-xyz', 'patient-789', 'note-456', '2024-06-15');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: {
              PK: 'CLINIC#clinic-xyz#PATIENT#patient-789',
              SK: 'NOTE#2024-06-15#note-456',
            },
          }),
        })
      );
    });
  });

  describe('findByIdWithoutStudyDate', () => {
    it('should return a note when found', async () => {
      const mockItem = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id',
        noteId: 'note-id',
        clinicId: 'clinic-abc',
        patientId: 'patient-123',
        studyDate: '2024-01-15',
        title: 'Test Note',
        content: 'Test content',
        attachments: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        createdBy: 'user-123',
        updatedBy: 'user-123',
        version: 1,
        entityType: 'NOTE',
      };

      mockSend.mockResolvedValue({ Items: [mockItem] });

      const result = await notesRepository.findByIdWithoutStudyDate('clinic-abc', 'patient-123', 'note-id');

      expect(result).not.toBeNull();
      expect(result?.noteId).toBe('note-id');
    });

    it('should return null when no items found', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await notesRepository.findByIdWithoutStudyDate('clinic-abc', 'patient-123', 'note-id');

      expect(result).toBeNull();
    });

    it('should return null when Items is undefined', async () => {
      mockSend.mockResolvedValue({ Items: undefined });

      const result = await notesRepository.findByIdWithoutStudyDate('clinic-abc', 'patient-123', 'note-id');

      expect(result).toBeNull();
    });

    it('should query with correct filter expression', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await notesRepository.findByIdWithoutStudyDate('clinic-abc', 'patient-123', 'target-note-id');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            FilterExpression: 'noteId = :noteId AND attribute_not_exists(deletedAt)',
            ExpressionAttributeValues: expect.objectContaining({
              ':pk': 'CLINIC#clinic-abc#PATIENT#patient-123',
              ':skPrefix': 'NOTE#',
              ':noteId': 'target-note-id',
            }),
          }),
        })
      );
    });
  });

  describe('list', () => {
    it('should return paginated notes', async () => {
      const mockItems = [
        {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
          SK: 'NOTE#2024-01-15#note-1',
          noteId: 'note-1',
          clinicId: 'clinic-abc',
          patientId: 'patient-123',
          studyDate: '2024-01-15',
          title: 'Note 1',
          content: 'Content 1',
          attachments: [],
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          createdBy: 'user-123',
          updatedBy: 'user-123',
          version: 1,
          entityType: 'NOTE',
        },
        {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
          SK: 'NOTE#2024-01-16#note-2',
          noteId: 'note-2',
          clinicId: 'clinic-abc',
          patientId: 'patient-123',
          studyDate: '2024-01-16',
          title: 'Note 2',
          content: 'Content 2',
          attachments: [],
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          createdBy: 'user-123',
          updatedBy: 'user-123',
          version: 1,
          entityType: 'NOTE',
        },
      ];

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await notesRepository.list('clinic-abc', 'patient-123', { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should indicate hasMore when more items exist', async () => {
      // Return limit + 1 items to indicate more exist
      const mockItems = Array.from({ length: 11 }, (_, i) => ({
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: `NOTE#2024-01-${String(i + 1).padStart(2, '0')}#note-${i}`,
        noteId: `note-${i}`,
        clinicId: 'clinic-abc',
        patientId: 'patient-123',
        studyDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        attachments: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        createdBy: 'user-123',
        updatedBy: 'user-123',
        version: 1,
        entityType: 'NOTE',
      }));

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await notesRepository.list('clinic-abc', 'patient-123', { limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should filter by studyDateFrom', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await notesRepository.list('clinic-abc', 'patient-123', {
        limit: 10,
        studyDateFrom: '2024-01-15',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            KeyConditionExpression: 'PK = :pk AND SK >= :skStart',
            ExpressionAttributeValues: expect.objectContaining({
              ':skStart': 'NOTE#2024-01-15',
            }),
          }),
        })
      );
    });

    it('should filter by studyDateTo', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await notesRepository.list('clinic-abc', 'patient-123', {
        limit: 10,
        studyDateTo: '2024-12-31',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skPrefix AND :skEnd',
            ExpressionAttributeValues: expect.objectContaining({
              ':skPrefix': 'NOTE#',
              ':skEnd': 'NOTE#2024-12-31~',
            }),
          }),
        })
      );
    });

    it('should filter by studyDateFrom and studyDateTo', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await notesRepository.list('clinic-abc', 'patient-123', {
        limit: 10,
        studyDateFrom: '2024-01-01',
        studyDateTo: '2024-12-31',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skStart AND :skEnd',
            ExpressionAttributeValues: expect.objectContaining({
              ':skStart': 'NOTE#2024-01-01',
              ':skEnd': 'NOTE#2024-12-31~',
            }),
          }),
        })
      );
    });

    it('should filter by tag', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await notesRepository.list('clinic-abc', 'patient-123', {
        limit: 10,
        tag: 'sleep',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            FilterExpression: 'attribute_not_exists(deletedAt) AND contains(tags, :tag)',
            ExpressionAttributeValues: expect.objectContaining({
              ':tag': 'sleep',
            }),
          }),
        })
      );
    });

    it('should use cursor for pagination', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      // Create a valid cursor
      const cursorData = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id',
      };
      const cursor = Buffer.from(JSON.stringify(cursorData), 'utf-8').toString('base64url');

      await notesRepository.list('clinic-abc', 'patient-123', {
        limit: 10,
        cursor,
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ExclusiveStartKey: cursorData,
          }),
        })
      );
    });

    it('should handle empty result', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await notesRepository.list('clinic-abc', 'patient-123', { limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update note with new values', async () => {
      const updatedItem = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id',
        noteId: 'note-id',
        clinicId: 'clinic-abc',
        patientId: 'patient-123',
        studyDate: '2024-01-15',
        title: 'Updated Title',
        content: 'Updated content',
        attachments: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-16T10:00:00.000Z',
        createdBy: 'user-123',
        updatedBy: 'user-456',
        version: 2,
        entityType: 'NOTE',
      };

      mockSend.mockResolvedValue({ Attributes: updatedItem });

      const input: UpdateNoteInput = {
        title: 'Updated Title',
        content: 'Updated content',
        version: 1,
      };

      const result = await notesRepository.update(
        'clinic-abc',
        'patient-123',
        'note-id',
        '2024-01-15',
        'user-456',
        'Dr. Test',
        input
      );

      expect(result.title).toBe('Updated Title');
      expect(result.content).toBe('Updated content');
      expect(result.version).toBe(2);
      expect(result.updatedBy).toBe('user-456');
    });

    it('should update only title when content not provided', async () => {
      mockSend.mockResolvedValue({
        Attributes: {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
          SK: 'NOTE#2024-01-15#note-id',
          noteId: 'note-id',
          clinicId: 'clinic-abc',
          patientId: 'patient-123',
          studyDate: '2024-01-15',
          title: 'New Title',
          content: 'Original content',
          attachments: [],
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          createdBy: 'user-123',
          updatedBy: 'user-456',
          version: 2,
          entityType: 'NOTE',
        },
      });

      const input: UpdateNoteInput = {
        title: 'New Title',
        version: 1,
      };

      await notesRepository.update('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456', 'Dr. Test', input);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            UpdateExpression: expect.stringContaining('title = :title'),
          }),
        })
      );
    });

    it('should update attachments', async () => {
      const attachments = [
        {
          id: 'attach-1',
          fileName: 'file.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
          s3Key: 'path/to/file.pdf',
          uploadedAt: '2024-01-15T10:00:00.000Z',
        },
      ];

      mockSend.mockResolvedValue({
        Attributes: {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
          SK: 'NOTE#2024-01-15#note-id',
          noteId: 'note-id',
          clinicId: 'clinic-abc',
          patientId: 'patient-123',
          studyDate: '2024-01-15',
          title: 'Title',
          content: 'Content',
          attachments,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          createdBy: 'user-123',
          updatedBy: 'user-456',
          version: 2,
          entityType: 'NOTE',
        },
      });

      const input: UpdateNoteInput = {
        attachments,
        version: 1,
      };

      const result = await notesRepository.update(
        'clinic-abc',
        'patient-123',
        'note-id',
        '2024-01-15',
        'user-456',
        'Dr. Test',
        input
      );

      expect(result.attachments).toEqual(attachments);
    });

    it('should throw NotFoundError when note does not exist', async () => {
      mockSend.mockRejectedValue({ name: 'ConditionalCheckFailedException' });

      // Mock findById to return null
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const input: UpdateNoteInput = {
        title: 'Updated',
        version: 1,
      };

      await expect(
        notesRepository.update('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456', 'Dr. Test', input)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError on version mismatch', async () => {
      const error = { name: 'ConditionalCheckFailedException' };
      mockSend.mockRejectedValueOnce(error);

      // Mock findById to return existing note with different version
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
          SK: 'NOTE#2024-01-15#note-id',
          noteId: 'note-id',
          clinicId: 'clinic-abc',
          patientId: 'patient-123',
          studyDate: '2024-01-15',
          title: 'Title',
          content: 'Content',
          attachments: [],
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          createdBy: 'user-123',
          updatedBy: 'user-123',
          version: 3,
          entityType: 'NOTE',
        },
      });

      const input: UpdateNoteInput = {
        title: 'Updated',
        version: 1,
      };

      await expect(
        notesRepository.update('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456', 'Dr. Test', input)
      ).rejects.toThrow(ConflictError);
    });

    it('should throw NotFoundError if Attributes is undefined', async () => {
      mockSend.mockResolvedValue({ Attributes: undefined });

      const input: UpdateNoteInput = {
        title: 'Updated',
        version: 1,
      };

      await expect(
        notesRepository.update('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456', 'Dr. Test', input)
      ).rejects.toThrow(NotFoundError);
    });

    it('should propagate non-conditional check errors', async () => {
      const error = new Error('DynamoDB connection failed');
      mockSend.mockRejectedValue(error);

      const input: UpdateNoteInput = {
        title: 'Updated',
        version: 1,
      };

      await expect(
        notesRepository.update('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456', 'Dr. Test', input)
      ).rejects.toThrow('DynamoDB connection failed');
    });
  });

  describe('softDelete', () => {
    it('should soft delete a note', async () => {
      mockSend.mockResolvedValue({});

      await notesRepository.softDelete('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: {
              PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
              SK: 'NOTE#2024-01-15#note-id',
            },
            UpdateExpression: 'SET deletedAt = :deletedAt, deletedBy = :deletedBy',
            ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(deletedAt)',
            ExpressionAttributeValues: expect.objectContaining({
              ':deletedBy': 'user-456',
            }),
          }),
        })
      );
    });

    it('should throw NotFoundError when note not found', async () => {
      mockSend.mockRejectedValue({ name: 'ConditionalCheckFailedException' });

      await expect(
        notesRepository.softDelete('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when note already deleted', async () => {
      mockSend.mockRejectedValue({ name: 'ConditionalCheckFailedException' });

      await expect(
        notesRepository.softDelete('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456')
      ).rejects.toThrow(NotFoundError);
    });

    it('should propagate non-conditional check errors', async () => {
      const error = new Error('DynamoDB error');
      mockSend.mockRejectedValue(error);

      await expect(
        notesRepository.softDelete('clinic-abc', 'patient-123', 'note-id', '2024-01-15', 'user-456')
      ).rejects.toThrow('DynamoDB error');
    });
  });

  describe('hardDelete', () => {
    it('should hard delete a note', async () => {
      mockSend.mockResolvedValue({});

      await notesRepository.hardDelete('clinic-abc', 'patient-123', 'note-id', '2024-01-15');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'TestTable',
            Key: {
              PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
              SK: 'NOTE#2024-01-15#note-id',
            },
          }),
        })
      );
    });

    it('should not throw when note does not exist', async () => {
      mockSend.mockResolvedValue({});

      await expect(
        notesRepository.hardDelete('clinic-abc', 'patient-123', 'nonexistent', '2024-01-15')
      ).resolves.toBeUndefined();
    });
  });
});
