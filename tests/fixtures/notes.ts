import { v4 as uuidv4 } from 'uuid';
import { Note, NoteDTO, CreateNoteInput, UpdateNoteInput, Attachment } from '../../src/types';

export function createMockNote(overrides?: Partial<Note>): Note {
  const now = new Date().toISOString();
  return {
    noteId: uuidv4(),
    clinicId: 'clinic-abc',
    patientId: 'patient-123',
    studyDate: '2024-01-15',
    title: 'Sleep Study Results',
    content: 'Patient shows signs of moderate sleep apnea.',
    attachments: [],
    createdAt: now,
    updatedAt: now,
    createdBy: 'user-123',
    createdByName: 'Dr. Smith',
    updatedBy: 'user-123',
    updatedByName: 'Dr. Smith',
    version: 1,
    ...overrides,
  };
}

export function createMockNoteDTO(overrides?: Partial<NoteDTO>): NoteDTO {
  const note = createMockNote();
  return {
    noteId: note.noteId,
    patientId: note.patientId,
    studyDate: note.studyDate,
    title: note.title,
    content: note.content,
    attachments: note.attachments,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    createdBy: note.createdBy,
    createdByName: note.createdByName,
    version: note.version,
    ...overrides,
  };
}

export function createMockCreateNoteInput(overrides?: Partial<CreateNoteInput>): CreateNoteInput {
  return {
    studyDate: '2024-01-15',
    title: 'Sleep Study Results',
    content: 'Patient shows signs of moderate sleep apnea.',
    ...overrides,
  };
}

export function createMockUpdateNoteInput(overrides?: Partial<UpdateNoteInput>): UpdateNoteInput {
  return {
    title: 'Updated Sleep Study Results',
    content: 'Updated content with additional findings.',
    version: 1,
    ...overrides,
  };
}

export function createMockAttachment(overrides?: Partial<Attachment>): Attachment {
  return {
    id: uuidv4(),
    fileName: 'sleep_study.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024 * 1024,
    s3Key: 'clinic/clinic-abc/patient/patient-123/note/note-id/attachment-id/sleep_study.pdf',
    uploadedAt: new Date().toISOString(),
    ...overrides,
  };
}
