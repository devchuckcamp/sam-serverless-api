export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  s3Key: string;
  uploadedAt: string;
}

export interface Note {
  noteId: string;
  clinicId: string;
  patientId: string;
  studyDate: string;
  title: string;
  content: string;
  noteType?: string;
  tags?: string[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  version: number;
  deletedAt?: string;
  deletedBy?: string;
}

export interface NoteDTO {
  noteId: string;
  patientId: string;
  studyDate: string;
  title: string;
  content: string;
  noteType?: string;
  tags?: string[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
  version: number;
}

export interface CreateNoteInput {
  studyDate: string;
  title: string;
  content: string;
  noteType?: string;
  tags?: string[];
  attachments?: Attachment[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  noteType?: string;
  tags?: string[];
  attachments?: Attachment[];
  version: number;
}

export interface ListNotesQuery {
  cursor?: string;
  limit?: number;
  studyDateFrom?: string;
  studyDateTo?: string;
  tag?: string;
  q?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface PresignUploadInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignUploadResponse {
  uploadUrl: string;
  s3Key: string;
  attachmentId: string;
  expiresIn: number;
}

export interface PresignDownloadResponse {
  downloadUrl: string;
  fileName: string;
  contentType: string;
  expiresIn: number;
}

export function toNoteDTO(note: Note): NoteDTO {
  return {
    noteId: note.noteId,
    patientId: note.patientId,
    studyDate: note.studyDate,
    title: note.title,
    content: note.content,
    noteType: note.noteType,
    tags: note.tags,
    attachments: note.attachments,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    createdBy: note.createdBy,
    createdByName: note.createdByName,
    version: note.version,
  };
}
