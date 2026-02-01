import { Scope } from '../../../src/types/auth';
import { ForbiddenError, NotFoundError } from '../../../src/lib/errors';
import * as notesService from '../../../src/services/notes.service';
import * as notesRepository from '../../../src/data/notes.repository';
import * as patientAccess from '../../../src/lib/patient-access';
import { createMockAuthContext, createAdminAuthContext, createReadOnlyAuthContext } from '../../fixtures/auth';
import { createMockNote, createMockCreateNoteInput, createMockUpdateNoteInput } from '../../fixtures/notes';

jest.mock('../../../src/data/notes.repository');
jest.mock('../../../src/lib/patient-access');
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  },
}));

const mockedPatientAccess = patientAccess as jest.Mocked<typeof patientAccess>;

const mockedRepository = notesRepository as jest.Mocked<typeof notesRepository>;

describe('notesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // By default, allow patient access
    mockedPatientAccess.assertPatientAccess.mockResolvedValue(undefined);
  });

  describe('createNote', () => {
    it('should create a note with valid input', async () => {
      const auth = createMockAuthContext();
      const input = createMockCreateNoteInput();
      const mockNote = createMockNote({ patientId: 'patient-123' });
      mockedRepository.create.mockResolvedValue(mockNote);

      const result = await notesService.createNote(auth, 'patient-123', input);

      expect(result.noteId).toBe(mockNote.noteId);
      expect(result.patientId).toBe('patient-123');
      expect(mockedRepository.create).toHaveBeenCalledWith(
        auth.clinicId,
        'patient-123',
        auth.userId,
        auth.username,
        input
      );
    });

    it('should throw ForbiddenError when user lacks NOTES_WRITE scope', async () => {
      const auth = createReadOnlyAuthContext();
      const input = createMockCreateNoteInput();

      await expect(notesService.createNote(auth, 'patient-123', input))
        .rejects.toThrow(ForbiddenError);
    });

    it('should not include internal fields in returned DTO', async () => {
      const auth = createMockAuthContext();
      const input = createMockCreateNoteInput();
      const mockNote = createMockNote({
        clinicId: 'clinic-abc',
        createdBy: 'user-123',
        updatedBy: 'user-123',
      });
      mockedRepository.create.mockResolvedValue(mockNote);

      const result = await notesService.createNote(auth, 'patient-123', input);

      expect(result).not.toHaveProperty('clinicId');
      expect(result).toHaveProperty('createdBy');
      expect(result).toHaveProperty('createdByName');
      expect(result).not.toHaveProperty('updatedBy');
    });

    it('should throw ForbiddenError when patient not in clinic', async () => {
      const auth = createMockAuthContext();
      const input = createMockCreateNoteInput();
      mockedPatientAccess.assertPatientAccess.mockRejectedValue(
        new ForbiddenError('Patient not found or access denied')
      );

      await expect(notesService.createNote(auth, 'patient-123', input))
        .rejects.toThrow(ForbiddenError);
      await expect(notesService.createNote(auth, 'patient-123', input))
        .rejects.toThrow('Patient not found or access denied');
    });
  });

  describe('getNote', () => {
    it('should return a note when found', async () => {
      const auth = createMockAuthContext();
      const mockNote = createMockNote({ noteId: 'note-123' });
      mockedRepository.findByIdWithoutStudyDate.mockResolvedValue(mockNote);

      const result = await notesService.getNote(auth, 'patient-123', 'note-123');

      expect(result.noteId).toBe('note-123');
      expect(mockedRepository.findByIdWithoutStudyDate).toHaveBeenCalledWith(
        auth.clinicId,
        'patient-123',
        'note-123'
      );
    });

    it('should throw NotFoundError when note does not exist', async () => {
      const auth = createMockAuthContext();
      mockedRepository.findByIdWithoutStudyDate.mockResolvedValue(null);

      await expect(notesService.getNote(auth, 'patient-123', 'note-123'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when user lacks NOTES_READ scope', async () => {
      const auth = createMockAuthContext({ scopes: [] });

      await expect(notesService.getNote(auth, 'patient-123', 'note-123'))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe('listNotes', () => {
    it('should return paginated notes', async () => {
      const auth = createMockAuthContext();
      const mockNotes = [
        createMockNote({ noteId: 'note-1' }),
        createMockNote({ noteId: 'note-2' }),
      ];
      mockedRepository.list.mockResolvedValue({
        items: mockNotes,
        nextCursor: 'cursor-abc',
        hasMore: true,
      });

      const result = await notesService.listNotes(auth, 'patient-123', { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('cursor-abc');
      expect(result.hasMore).toBe(true);
    });

    it('should pass query parameters to repository', async () => {
      const auth = createMockAuthContext();
      mockedRepository.list.mockResolvedValue({
        items: [],
        hasMore: false,
      });

      await notesService.listNotes(auth, 'patient-123', {
        cursor: 'cursor-xyz',
        limit: 50,
        studyDateFrom: '2024-01-01',
        studyDateTo: '2024-12-31',
      });

      expect(mockedRepository.list).toHaveBeenCalledWith(
        auth.clinicId,
        'patient-123',
        {
          cursor: 'cursor-xyz',
          limit: 50,
          studyDateFrom: '2024-01-01',
          studyDateTo: '2024-12-31',
        }
      );
    });

    it('should use default limit of 20', async () => {
      const auth = createMockAuthContext();
      mockedRepository.list.mockResolvedValue({
        items: [],
        hasMore: false,
      });

      await notesService.listNotes(auth, 'patient-123', {});

      expect(mockedRepository.list).toHaveBeenCalledWith(
        auth.clinicId,
        'patient-123',
        expect.objectContaining({ limit: 20 })
      );
    });
  });

  describe('updateNote', () => {
    it('should update an existing note', async () => {
      const auth = createMockAuthContext();
      const existingNote = createMockNote({ noteId: 'note-123', version: 1 });
      const updatedNote = { ...existingNote, title: 'Updated Title', version: 2 };
      const input = createMockUpdateNoteInput({ version: 1 });

      mockedRepository.findByIdWithoutStudyDate.mockResolvedValue(existingNote);
      mockedRepository.update.mockResolvedValue(updatedNote);

      const result = await notesService.updateNote(auth, 'patient-123', 'note-123', input);

      expect(result.version).toBe(2);
      expect(mockedRepository.update).toHaveBeenCalledWith(
        auth.clinicId,
        'patient-123',
        'note-123',
        existingNote.studyDate,
        auth.userId,
        auth.username,
        input
      );
    });

    it('should throw NotFoundError when note does not exist', async () => {
      const auth = createMockAuthContext();
      const input = createMockUpdateNoteInput();
      mockedRepository.findByIdWithoutStudyDate.mockResolvedValue(null);

      await expect(notesService.updateNote(auth, 'patient-123', 'note-123', input))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when user lacks NOTES_WRITE scope', async () => {
      const auth = createReadOnlyAuthContext();
      const input = createMockUpdateNoteInput();

      await expect(notesService.updateNote(auth, 'patient-123', 'note-123', input))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe('deleteNote', () => {
    it('should soft delete an existing note', async () => {
      const auth = createAdminAuthContext();
      const existingNote = createMockNote({ noteId: 'note-123' });

      mockedRepository.findByIdWithoutStudyDate.mockResolvedValue(existingNote);
      mockedRepository.softDelete.mockResolvedValue();

      await notesService.deleteNote(auth, 'patient-123', 'note-123');

      expect(mockedRepository.softDelete).toHaveBeenCalledWith(
        auth.clinicId,
        'patient-123',
        'note-123',
        existingNote.studyDate,
        auth.userId
      );
    });

    it('should throw NotFoundError when note does not exist', async () => {
      const auth = createAdminAuthContext();
      mockedRepository.findByIdWithoutStudyDate.mockResolvedValue(null);

      await expect(notesService.deleteNote(auth, 'patient-123', 'note-123'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when user lacks NOTES_DELETE scope', async () => {
      const auth = createMockAuthContext({ scopes: [Scope.NOTES_READ, Scope.NOTES_WRITE] });

      await expect(notesService.deleteNote(auth, 'patient-123', 'note-123'))
        .rejects.toThrow(ForbiddenError);
    });
  });
});
