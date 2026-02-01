import { AuthContext, Scope } from '../types/auth';
import {
  NoteDTO,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesQuery,
  PaginatedResponse,
  toNoteDTO,
} from '../types';
import { requireScopes } from '../lib/auth';
import { NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';
import { assertPatientAccess } from '../lib/patient-access';
import * as notesRepository from '../data/notes.repository';

export async function createNote(
  auth: AuthContext,
  patientId: string,
  input: CreateNoteInput
): Promise<NoteDTO> {
  requireScopes(auth, Scope.NOTES_WRITE);
  await assertPatientAccess(auth, patientId);

  logger.info('Creating note', { patientId });

  const note = await notesRepository.create(auth.clinicId, patientId, auth.userId, auth.username, input);

  return toNoteDTO(note);
}

export async function getNote(
  auth: AuthContext,
  patientId: string,
  noteId: string
): Promise<NoteDTO> {
  requireScopes(auth, Scope.NOTES_READ);
  await assertPatientAccess(auth, patientId);

  logger.info('Getting note', { patientId, noteId });

  const note = await notesRepository.findByIdWithoutStudyDate(auth.clinicId, patientId, noteId);

  if (!note) {
    throw new NotFoundError('Note', noteId);
  }

  return toNoteDTO(note);
}

export async function listNotes(
  auth: AuthContext,
  patientId: string,
  query: ListNotesQuery
): Promise<PaginatedResponse<NoteDTO>> {
  requireScopes(auth, Scope.NOTES_READ);
  await assertPatientAccess(auth, patientId);

  logger.info('Listing notes', {
    patientId,
    cursor: query.cursor ? '[present]' : undefined,
    limit: query.limit,
    studyDateFrom: query.studyDateFrom,
    studyDateTo: query.studyDateTo,
    tag: query.tag,
    q: query.q ? '[present]' : undefined,
  });

  const limit = query.limit ?? 20;

  // If search query is provided, we need to fetch more results and filter in memory
  // since DynamoDB doesn't support full-text search
  if (query.q) {
    const searchTerm = query.q.toLowerCase();
    // Fetch more results to account for filtering
    const fetchLimit = Math.min(limit * 5, 100);

    const result = await notesRepository.list(auth.clinicId, patientId, {
      cursor: query.cursor,
      limit: fetchLimit,
      studyDateFrom: query.studyDateFrom,
      studyDateTo: query.studyDateTo,
      tag: query.tag,
    });

    // Filter by search term (title and content)
    const filteredItems = result.items.filter(note =>
      note.title.toLowerCase().includes(searchTerm) ||
      note.content.toLowerCase().includes(searchTerm)
    );

    // Apply pagination to filtered results
    const paginatedItems = filteredItems.slice(0, limit);
    const hasMore = filteredItems.length > limit || result.hasMore;

    return {
      items: paginatedItems.map(toNoteDTO),
      nextCursor: result.nextCursor,
      hasMore,
    };
  }

  const result = await notesRepository.list(auth.clinicId, patientId, {
    cursor: query.cursor,
    limit,
    studyDateFrom: query.studyDateFrom,
    studyDateTo: query.studyDateTo,
    tag: query.tag,
  });

  return {
    items: result.items.map(toNoteDTO),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function updateNote(
  auth: AuthContext,
  patientId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<NoteDTO> {
  requireScopes(auth, Scope.NOTES_WRITE);
  await assertPatientAccess(auth, patientId);

  logger.info('Updating note', { patientId, noteId, expectedVersion: input.version });

  const existing = await notesRepository.findByIdWithoutStudyDate(
    auth.clinicId,
    patientId,
    noteId
  );

  if (!existing) {
    throw new NotFoundError('Note', noteId);
  }

  const updated = await notesRepository.update(
    auth.clinicId,
    patientId,
    noteId,
    existing.studyDate,
    auth.userId,
    auth.username,
    input
  );

  return toNoteDTO(updated);
}

export async function deleteNote(
  auth: AuthContext,
  patientId: string,
  noteId: string
): Promise<void> {
  requireScopes(auth, Scope.NOTES_DELETE);
  await assertPatientAccess(auth, patientId);

  logger.info('Deleting note', { patientId, noteId });

  const existing = await notesRepository.findByIdWithoutStudyDate(
    auth.clinicId,
    patientId,
    noteId
  );

  if (!existing) {
    throw new NotFoundError('Note', noteId);
  }

  await notesRepository.softDelete(
    auth.clinicId,
    patientId,
    noteId,
    existing.studyDate,
    auth.userId
  );
}
