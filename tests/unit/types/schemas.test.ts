import { ZodError } from 'zod';
import {
  createNoteSchema,
  updateNoteSchema,
  listNotesQuerySchema,
  presignUploadSchema,
  pathParametersSchema,
  notePathParametersSchema,
  attachmentPathParametersSchema,
  attachmentSchema,
} from '../../../src/types/schemas';

describe('createNoteSchema', () => {
  it('should validate a valid create note input', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Sleep Study Results',
      content: 'Patient shows signs of moderate sleep apnea.',
    };

    const result = createNoteSchema.parse(input);

    expect(result).toEqual(input);
  });

  it('should validate input with attachments', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Sleep Study Results',
      content: 'Patient data.',
      attachments: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          fileName: 'report.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
          s3Key: 'clinic/c1/patient/p1/note/n1/a1/report.pdf',
          uploadedAt: '2024-01-15T10:30:00.000Z',
        },
      ],
    };

    const result = createNoteSchema.parse(input);

    expect(result.attachments).toHaveLength(1);
  });

  it('should reject invalid study date format', () => {
    const input = {
      studyDate: '01-15-2024', // Wrong format
      title: 'Title',
      content: 'Content',
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject empty title', () => {
    const input = {
      studyDate: '2024-01-15',
      title: '',
      content: 'Content',
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject empty content', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: '',
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject more than 10 attachments', () => {
    const attachments = Array.from({ length: 11 }, (_, i) => ({
      id: `550e8400-e29b-41d4-a716-44665544000${i}`,
      fileName: `file${i}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: `clinic/c1/patient/p1/note/n1/a${i}/file.pdf`,
      uploadedAt: '2024-01-15T10:30:00.000Z',
    }));

    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      attachments,
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject attachment exceeding 100MB', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      attachments: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          fileName: 'large.pdf',
          contentType: 'application/pdf',
          sizeBytes: 101 * 1024 * 1024, // 101MB
          s3Key: 'clinic/c1/patient/p1/note/n1/a1/large.pdf',
          uploadedAt: '2024-01-15T10:30:00.000Z',
        },
      ],
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });
});

describe('updateNoteSchema', () => {
  it('should validate a valid update with all fields', () => {
    const input = {
      title: 'Updated Title',
      content: 'Updated content',
      version: 1,
    };

    const result = updateNoteSchema.parse(input);

    expect(result).toEqual(input);
  });

  it('should require version field', () => {
    const input = {
      title: 'Updated Title',
    };

    expect(() => updateNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should allow partial updates with only title', () => {
    const input = {
      title: 'Updated Title',
      version: 2,
    };

    const result = updateNoteSchema.parse(input);

    expect(result.title).toBe('Updated Title');
    expect(result.content).toBeUndefined();
  });

  it('should reject version of 0 or less', () => {
    const input = {
      title: 'Title',
      version: 0,
    };

    expect(() => updateNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject negative version', () => {
    const input = {
      title: 'Title',
      version: -1,
    };

    expect(() => updateNoteSchema.parse(input)).toThrow(ZodError);
  });
});

describe('listNotesQuerySchema', () => {
  it('should validate empty query with defaults', () => {
    const result = listNotesQuerySchema.parse({});

    expect(result.limit).toBe(20);
  });

  it('should validate query with all parameters', () => {
    const input = {
      cursor: 'abc123',
      limit: '50',
      studyDateFrom: '2024-01-01',
      studyDateTo: '2024-12-31',
    };

    const result = listNotesQuerySchema.parse(input);

    expect(result.cursor).toBe('abc123');
    expect(result.limit).toBe(50);
    expect(result.studyDateFrom).toBe('2024-01-01');
    expect(result.studyDateTo).toBe('2024-12-31');
  });

  it('should coerce string limit to number', () => {
    const input = { limit: '25' };

    const result = listNotesQuerySchema.parse(input);

    expect(result.limit).toBe(25);
  });

  it('should reject limit greater than 100', () => {
    const input = { limit: '150' };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });

  it('should reject limit less than 1', () => {
    const input = { limit: '0' };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });

  it('should reject invalid date format for studyDateFrom', () => {
    const input = { studyDateFrom: '2024/01/15' };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });

  it('should reject invalid date format for studyDateTo', () => {
    const input = { studyDateTo: 'January 15, 2024' };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });
});

describe('presignUploadSchema', () => {
  it('should validate valid presign input', () => {
    const input = {
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024 * 1024,
    };

    const result = presignUploadSchema.parse(input);

    expect(result).toEqual(input);
  });

  it('should reject empty fileName', () => {
    const input = {
      fileName: '',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    };

    expect(() => presignUploadSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject sizeBytes exceeding 100MB', () => {
    const input = {
      fileName: 'large.pdf',
      contentType: 'application/pdf',
      sizeBytes: 101 * 1024 * 1024,
    };

    expect(() => presignUploadSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject zero sizeBytes', () => {
    const input = {
      fileName: 'empty.pdf',
      contentType: 'application/pdf',
      sizeBytes: 0,
    };

    expect(() => presignUploadSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject negative sizeBytes', () => {
    const input = {
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: -100,
    };

    expect(() => presignUploadSchema.parse(input)).toThrow(ZodError);
  });
});

describe('pathParametersSchema', () => {
  it('should validate valid patient ID', () => {
    const input = { patientId: 'patient-123' };

    const result = pathParametersSchema.parse(input);

    expect(result.patientId).toBe('patient-123');
  });

  it('should reject empty patient ID', () => {
    const input = { patientId: '' };

    expect(() => pathParametersSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject patient ID longer than 100 chars', () => {
    const input = { patientId: 'a'.repeat(101) };

    expect(() => pathParametersSchema.parse(input)).toThrow(ZodError);
  });
});

describe('notePathParametersSchema', () => {
  it('should validate valid path parameters', () => {
    const input = {
      patientId: 'patient-123',
      noteId: '550e8400-e29b-41d4-a716-446655440000',
    };

    const result = notePathParametersSchema.parse(input);

    expect(result.patientId).toBe('patient-123');
    expect(result.noteId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should reject non-UUID noteId', () => {
    const input = {
      patientId: 'patient-123',
      noteId: 'not-a-uuid',
    };

    expect(() => notePathParametersSchema.parse(input)).toThrow(ZodError);
  });
});

describe('attachmentPathParametersSchema', () => {
  it('should validate valid attachment path parameters', () => {
    const input = {
      patientId: 'patient-123',
      noteId: '550e8400-e29b-41d4-a716-446655440000',
      attachmentId: '550e8400-e29b-41d4-a716-446655440001',
    };

    const result = attachmentPathParametersSchema.parse(input);

    expect(result.patientId).toBe('patient-123');
    expect(result.noteId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.attachmentId).toBe('550e8400-e29b-41d4-a716-446655440001');
  });

  it('should reject non-UUID attachmentId', () => {
    const input = {
      patientId: 'patient-123',
      noteId: '550e8400-e29b-41d4-a716-446655440000',
      attachmentId: 'not-a-uuid',
    };

    expect(() => attachmentPathParametersSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject missing attachmentId', () => {
    const input = {
      patientId: 'patient-123',
      noteId: '550e8400-e29b-41d4-a716-446655440000',
    };

    expect(() => attachmentPathParametersSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject empty patientId', () => {
    const input = {
      patientId: '',
      noteId: '550e8400-e29b-41d4-a716-446655440000',
      attachmentId: '550e8400-e29b-41d4-a716-446655440001',
    };

    expect(() => attachmentPathParametersSchema.parse(input)).toThrow(ZodError);
  });
});

describe('attachmentSchema', () => {
  it('should validate a valid attachment', () => {
    const input = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024 * 1024,
      s3Key: 'clinic/c1/patient/p1/note/n1/a1/report.pdf',
      uploadedAt: '2024-01-15T10:30:00.000Z',
    };

    const result = attachmentSchema.parse(input);

    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.fileName).toBe('report.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect(result.sizeBytes).toBe(1024 * 1024);
    expect(result.s3Key).toBe('clinic/c1/patient/p1/note/n1/a1/report.pdf');
    expect(result.uploadedAt).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should reject non-UUID id', () => {
    const input = {
      id: 'not-a-uuid',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: 'path/to/file',
      uploadedAt: '2024-01-15T10:30:00.000Z',
    };

    expect(() => attachmentSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject empty fileName', () => {
    const input = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      fileName: '',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: 'path/to/file',
      uploadedAt: '2024-01-15T10:30:00.000Z',
    };

    expect(() => attachmentSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject fileName longer than 255 chars', () => {
    const input = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      fileName: 'a'.repeat(256),
      contentType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: 'path/to/file',
      uploadedAt: '2024-01-15T10:30:00.000Z',
    };

    expect(() => attachmentSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject sizeBytes exceeding 100MB', () => {
    const input = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      fileName: 'large.pdf',
      contentType: 'application/pdf',
      sizeBytes: 101 * 1024 * 1024,
      s3Key: 'path/to/file',
      uploadedAt: '2024-01-15T10:30:00.000Z',
    };

    expect(() => attachmentSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject invalid uploadedAt format', () => {
    const input = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: 'path/to/file',
      uploadedAt: '2024-01-15', // Missing time
    };

    expect(() => attachmentSchema.parse(input)).toThrow(ZodError);
  });

  it('should accept uploadedAt with milliseconds', () => {
    const input = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: 'path/to/file',
      uploadedAt: '2024-01-15T10:30:00.123Z',
    };

    const result = attachmentSchema.parse(input);

    expect(result.uploadedAt).toBe('2024-01-15T10:30:00.123Z');
  });

  it('should accept uploadedAt without milliseconds', () => {
    const input = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: 'path/to/file',
      uploadedAt: '2024-01-15T10:30:00Z',
    };

    const result = attachmentSchema.parse(input);

    expect(result.uploadedAt).toBe('2024-01-15T10:30:00Z');
  });
});

describe('createNoteSchema - additional tests', () => {
  it('should validate note with noteType', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      noteType: 'clinical',
    };

    const result = createNoteSchema.parse(input);

    expect(result.noteType).toBe('clinical');
  });

  it('should validate note with tags', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      tags: ['sleep', 'apnea', 'severe'],
    };

    const result = createNoteSchema.parse(input);

    expect(result.tags).toEqual(['sleep', 'apnea', 'severe']);
  });

  it('should reject more than 20 tags', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject empty tag string', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      tags: ['valid', ''],
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject tag longer than 50 chars', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      tags: ['a'.repeat(51)],
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject title longer than 500 chars', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'a'.repeat(501),
      content: 'Content',
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject content longer than 50000 chars', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'a'.repeat(50001),
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });

  it('should reject noteType longer than 50 chars', () => {
    const input = {
      studyDate: '2024-01-15',
      title: 'Title',
      content: 'Content',
      noteType: 'a'.repeat(51),
    };

    expect(() => createNoteSchema.parse(input)).toThrow(ZodError);
  });
});

describe('listNotesQuerySchema - additional tests', () => {
  it('should validate query with tag parameter', () => {
    const input = { tag: 'sleep' };

    const result = listNotesQuerySchema.parse(input);

    expect(result.tag).toBe('sleep');
  });

  it('should validate query with search parameter', () => {
    const input = { q: 'apnea' };

    const result = listNotesQuerySchema.parse(input);

    expect(result.q).toBe('apnea');
  });

  it('should reject empty tag', () => {
    const input = { tag: '' };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });

  it('should reject tag longer than 50 chars', () => {
    const input = { tag: 'a'.repeat(51) };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });

  it('should reject empty search query', () => {
    const input = { q: '' };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });

  it('should reject search query longer than 200 chars', () => {
    const input = { q: 'a'.repeat(201) };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });

  it('should reject empty cursor', () => {
    const input = { cursor: '' };

    expect(() => listNotesQuerySchema.parse(input)).toThrow(ZodError);
  });
});
