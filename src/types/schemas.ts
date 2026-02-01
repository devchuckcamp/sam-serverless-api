import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
  s3Key: z.string().min(1).max(1024),
  uploadedAt: z.string().regex(ISO_DATETIME_REGEX, 'Must be ISO 8601 datetime'),
});

export const createNoteSchema = z.object({
  studyDate: z.string().regex(ISO_DATE_REGEX, 'Must be YYYY-MM-DD format'),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(50000),
  noteType: z.string().min(1).max(50).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(50000).optional(),
  noteType: z.string().min(1).max(50).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  version: z.number().int().positive(),
});

export const listNotesQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  studyDateFrom: z.string().regex(ISO_DATE_REGEX, 'Must be YYYY-MM-DD format').optional(),
  studyDateTo: z.string().regex(ISO_DATE_REGEX, 'Must be YYYY-MM-DD format').optional(),
  tag: z.string().min(1).max(50).optional(),
  q: z.string().min(1).max(200).optional(),
});

export const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
});

export const pathParametersSchema = z.object({
  patientId: z.string().min(1).max(100),
});

export const notePathParametersSchema = z.object({
  patientId: z.string().min(1).max(100),
  noteId: z.string().uuid(),
});

export const attachmentPathParametersSchema = z.object({
  patientId: z.string().min(1).max(100),
  noteId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

export type CreateNoteSchemaType = z.infer<typeof createNoteSchema>;
export type UpdateNoteSchemaType = z.infer<typeof updateNoteSchema>;
export type ListNotesQuerySchemaType = z.infer<typeof listNotesQuerySchema>;
export type PresignUploadSchemaType = z.infer<typeof presignUploadSchema>;
export type AttachmentPathParametersSchemaType = z.infer<typeof attachmentPathParametersSchema>;
