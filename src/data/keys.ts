export function buildPK(clinicId: string, patientId: string): string {
  return `CLINIC#${clinicId}#PATIENT#${patientId}`;
}

export function buildSK(studyDate: string, noteId: string): string {
  return `NOTE#${studyDate}#${noteId}`;
}

export interface ParsedSK {
  studyDate: string;
  noteId: string;
}

export function parseSK(sk: string): ParsedSK {
  const parts = sk.split('#');
  if (parts.length !== 3 || parts[0] !== 'NOTE') {
    throw new Error(`Invalid SK format: ${sk}`);
  }
  return {
    studyDate: parts[1] ?? '',
    noteId: parts[2] ?? '',
  };
}

export interface ParsedPK {
  clinicId: string;
  patientId: string;
}

export function parsePK(pk: string): ParsedPK {
  const parts = pk.split('#');
  if (parts.length !== 4 || parts[0] !== 'CLINIC' || parts[2] !== 'PATIENT') {
    throw new Error(`Invalid PK format: ${pk}`);
  }
  return {
    clinicId: parts[1] ?? '',
    patientId: parts[3] ?? '',
  };
}

export function buildS3Key(
  clinicId: string,
  patientId: string,
  noteId: string,
  attachmentId: string,
  fileName: string
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `clinic/${clinicId}/patient/${patientId}/note/${noteId}/${attachmentId}/${sanitizedFileName}`;
}

// Clinic keys (single-table design)
export function buildClinicPK(clinicId: string): string {
  return `CLINIC#${clinicId}`;
}

export function buildClinicSK(): string {
  return 'METADATA';
}

// Patient keys (single-table design)
export function buildPatientPK(clinicId: string, patientId: string): string {
  return `CLINIC#${clinicId}#PATIENT#${patientId}`;
}

export function buildPatientSK(): string {
  return 'METADATA';
}

// User keys (single-table design)
export function buildUserPK(clinicId: string, userId: string): string {
  return `CLINIC#${clinicId}#USER#${userId}`;
}

export function buildUserSK(): string {
  return 'METADATA';
}
