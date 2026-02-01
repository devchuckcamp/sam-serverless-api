import { toNoteDTO, Note, NoteDTO } from '../../../src/types';
import { createMockNote } from '../../fixtures/notes';

describe('toNoteDTO', () => {
  it('should convert Note to NoteDTO with all fields', () => {
    const note: Note = {
      noteId: 'note-123',
      clinicId: 'clinic-abc',
      patientId: 'patient-456',
      studyDate: '2024-01-15',
      title: 'Sleep Study Results',
      content: 'Patient shows signs of moderate sleep apnea.',
      noteType: 'clinical',
      tags: ['sleep', 'apnea'],
      attachments: [
        {
          id: 'attach-1',
          fileName: 'report.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
          s3Key: 'path/to/file.pdf',
          uploadedAt: '2024-01-15T10:00:00.000Z',
        },
      ],
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T12:00:00.000Z',
      createdBy: 'user-123',
      createdByName: 'Dr. Smith',
      updatedBy: 'user-456',
      updatedByName: 'Dr. Jones',
      version: 2,
    };

    const result = toNoteDTO(note);

    expect(result.noteId).toBe('note-123');
    expect(result.patientId).toBe('patient-456');
    expect(result.studyDate).toBe('2024-01-15');
    expect(result.title).toBe('Sleep Study Results');
    expect(result.content).toBe('Patient shows signs of moderate sleep apnea.');
    expect(result.noteType).toBe('clinical');
    expect(result.tags).toEqual(['sleep', 'apnea']);
    expect(result.attachments).toHaveLength(1);
    expect(result.createdAt).toBe('2024-01-15T10:00:00.000Z');
    expect(result.updatedAt).toBe('2024-01-15T12:00:00.000Z');
    expect(result.version).toBe(2);
  });

  it('should exclude clinicId from DTO', () => {
    const note = createMockNote({ clinicId: 'clinic-secret' });

    const result = toNoteDTO(note);

    expect(result).not.toHaveProperty('clinicId');
  });

  it('should include createdBy and createdByName in DTO', () => {
    const note = createMockNote({ createdBy: 'user-secret', createdByName: 'Dr. Secret' });

    const result = toNoteDTO(note);

    expect(result.createdBy).toBe('user-secret');
    expect(result.createdByName).toBe('Dr. Secret');
  });

  it('should exclude updatedBy from DTO', () => {
    const note = createMockNote({ updatedBy: 'user-secret' });

    const result = toNoteDTO(note);

    expect(result).not.toHaveProperty('updatedBy');
  });

  it('should exclude deletedAt from DTO', () => {
    const note = createMockNote({ deletedAt: '2024-01-20T10:00:00.000Z' });

    const result = toNoteDTO(note);

    expect(result).not.toHaveProperty('deletedAt');
  });

  it('should exclude deletedBy from DTO', () => {
    const note = createMockNote({ deletedBy: 'user-deleter' });

    const result = toNoteDTO(note);

    expect(result).not.toHaveProperty('deletedBy');
  });

  it('should handle note with empty tags array', () => {
    const note = createMockNote({ tags: [] });

    const result = toNoteDTO(note);

    expect(result.tags).toEqual([]);
  });

  it('should handle note with undefined tags', () => {
    const note = createMockNote({ tags: undefined });

    const result = toNoteDTO(note);

    expect(result.tags).toBeUndefined();
  });

  it('should handle note with empty attachments array', () => {
    const note = createMockNote({ attachments: [] });

    const result = toNoteDTO(note);

    expect(result.attachments).toEqual([]);
  });

  it('should handle note with undefined noteType', () => {
    const note = createMockNote({ noteType: undefined });

    const result = toNoteDTO(note);

    expect(result.noteType).toBeUndefined();
  });

  it('should preserve all attachment fields', () => {
    const attachment = {
      id: 'attach-123',
      fileName: 'study.dicom',
      contentType: 'application/dicom',
      sizeBytes: 50 * 1024 * 1024,
      s3Key: 'clinic/c1/patient/p1/note/n1/a1/study.dicom',
      uploadedAt: '2024-01-15T14:30:00.000Z',
    };
    const note = createMockNote({ attachments: [attachment] });

    const result = toNoteDTO(note);

    expect(result.attachments[0]).toEqual(attachment);
  });

  it('should handle multiple attachments', () => {
    const attachments = [
      {
        id: 'attach-1',
        fileName: 'file1.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        s3Key: 'path/file1.pdf',
        uploadedAt: '2024-01-15T10:00:00.000Z',
      },
      {
        id: 'attach-2',
        fileName: 'file2.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 2048,
        s3Key: 'path/file2.jpg',
        uploadedAt: '2024-01-15T11:00:00.000Z',
      },
    ];
    const note = createMockNote({ attachments });

    const result = toNoteDTO(note);

    expect(result.attachments).toHaveLength(2);
    expect(result.attachments![0]!.fileName).toBe('file1.pdf');
    expect(result.attachments![1]!.fileName).toBe('file2.jpg');
  });

  it('should return proper NoteDTO type structure', () => {
    const note = createMockNote();

    const result: NoteDTO = toNoteDTO(note);

    // Type assertion - if this compiles, the return type is correct
    expect(result).toBeDefined();

    // Verify all expected fields exist
    expect(result).toHaveProperty('noteId');
    expect(result).toHaveProperty('patientId');
    expect(result).toHaveProperty('studyDate');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('attachments');
    expect(result).toHaveProperty('createdAt');
    expect(result).toHaveProperty('updatedAt');
    expect(result).toHaveProperty('createdBy');
    expect(result).toHaveProperty('createdByName');
    expect(result).toHaveProperty('version');
  });
});
