import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { AuthContext, Scope } from '../types/auth';
import { PresignUploadInput, PresignUploadResponse, PresignDownloadResponse } from '../types';
import { requireScopes } from '../lib/auth';
import { NotFoundError, ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { assertPatientAccess } from '../lib/patient-access';
import { buildS3Key } from '../data/keys';
import * as notesRepository from '../data/notes.repository';

const isLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.IS_LOCAL === 'true';

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  ...(isLocal && {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:4566',
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  }),
});

const BUCKET_NAME = process.env.ATTACHMENTS_BUCKET ?? 'snoremd-attachments';
const PRESIGN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/dicom',
];

export async function generatePresignedUploadUrl(
  auth: AuthContext,
  patientId: string,
  noteId: string,
  input: PresignUploadInput
): Promise<PresignUploadResponse> {
  requireScopes(auth, Scope.ATTACHMENTS_WRITE);
  await assertPatientAccess(auth, patientId);

  if (input.sizeBytes > MAX_FILE_SIZE) {
    throw new ValidationError(`File size exceeds maximum allowed (${MAX_FILE_SIZE} bytes)`);
  }

  if (!ALLOWED_CONTENT_TYPES.includes(input.contentType)) {
    throw new ValidationError(
      `Content type not allowed: ${input.contentType}. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`
    );
  }

  const attachmentId = uuidv4();
  const s3Key = buildS3Key(auth.clinicId, patientId, noteId, attachmentId, input.fileName);

  logger.info('Generating presigned upload URL', {
    patientId,
    noteId,
    attachmentId,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
    Metadata: {
      'clinic-id': auth.clinicId,
      'patient-id': patientId,
      'note-id': noteId,
      'attachment-id': attachmentId,
      'uploaded-by': auth.userId,
    },
  });

  // signableHeaders controls which headers are included in the signature
  // Exclude checksum headers so browsers can upload without computing checksums
  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
    signableHeaders: new Set(['host', 'content-type', 'content-length']),
  });

  return {
    uploadUrl,
    s3Key,
    attachmentId,
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  };
}

export async function generatePresignedDownloadUrl(
  auth: AuthContext,
  patientId: string,
  noteId: string,
  attachmentId: string
): Promise<PresignDownloadResponse> {
  requireScopes(auth, Scope.NOTES_READ);
  await assertPatientAccess(auth, patientId);

  // Look up the note to get attachment metadata
  const note = await notesRepository.findByIdWithoutStudyDate(auth.clinicId, patientId, noteId);

  if (!note) {
    throw new NotFoundError('Note', noteId);
  }

  // Find the attachment in the note
  const attachment = note.attachments.find((a) => a.id === attachmentId);

  if (!attachment) {
    throw new NotFoundError('Attachment', attachmentId);
  }

  logger.info('Generating presigned download URL', {
    patientId,
    noteId,
    attachmentId,
    fileName: attachment.fileName,
  });

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: attachment.s3Key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    ResponseContentType: attachment.contentType,
  });

  const downloadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return {
    downloadUrl,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  };
}
