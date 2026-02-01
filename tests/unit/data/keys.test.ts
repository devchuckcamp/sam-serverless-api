import {
  buildPK,
  buildSK,
  parsePK,
  parseSK,
  buildS3Key,
  buildClinicPK,
  buildClinicSK,
  buildPatientPK,
  buildPatientSK,
  buildUserPK,
  buildUserSK,
} from '../../../src/data/keys';

describe('DynamoDB key functions', () => {
  describe('buildPK', () => {
    it('should build a valid partition key', () => {
      const result = buildPK('clinic-123', 'patient-456');

      expect(result).toBe('CLINIC#clinic-123#PATIENT#patient-456');
    });

    it('should handle special characters in IDs', () => {
      const result = buildPK('clinic-with-dash', 'patient_with_underscore');

      expect(result).toBe('CLINIC#clinic-with-dash#PATIENT#patient_with_underscore');
    });
  });

  describe('buildSK', () => {
    it('should build a valid sort key', () => {
      const result = buildSK('2024-01-15', 'note-id-123');

      expect(result).toBe('NOTE#2024-01-15#note-id-123');
    });
  });

  describe('parsePK', () => {
    it('should parse a valid partition key', () => {
      const result = parsePK('CLINIC#clinic-123#PATIENT#patient-456');

      expect(result.clinicId).toBe('clinic-123');
      expect(result.patientId).toBe('patient-456');
    });

    it('should throw error for invalid PK format - wrong prefix', () => {
      expect(() => parsePK('INVALID#clinic-123#PATIENT#patient-456')).toThrow(
        'Invalid PK format'
      );
    });

    it('should throw error for invalid PK format - missing PATIENT', () => {
      expect(() => parsePK('CLINIC#clinic-123#INVALID#patient-456')).toThrow(
        'Invalid PK format'
      );
    });

    it('should throw error for invalid PK format - wrong number of parts', () => {
      expect(() => parsePK('CLINIC#clinic-123')).toThrow('Invalid PK format');
    });
  });

  describe('parseSK', () => {
    it('should parse a valid sort key', () => {
      const result = parseSK('NOTE#2024-01-15#note-id-123');

      expect(result.studyDate).toBe('2024-01-15');
      expect(result.noteId).toBe('note-id-123');
    });

    it('should throw error for invalid SK format - wrong prefix', () => {
      expect(() => parseSK('INVALID#2024-01-15#note-id')).toThrow('Invalid SK format');
    });

    it('should throw error for invalid SK format - wrong number of parts', () => {
      expect(() => parseSK('NOTE#2024-01-15')).toThrow('Invalid SK format');
    });
  });

  describe('buildS3Key', () => {
    it('should build a valid S3 key', () => {
      const result = buildS3Key(
        'clinic-123',
        'patient-456',
        'note-789',
        'attach-abc',
        'report.pdf'
      );

      expect(result).toBe(
        'clinic/clinic-123/patient/patient-456/note/note-789/attach-abc/report.pdf'
      );
    });

    it('should sanitize file names with special characters', () => {
      const result = buildS3Key(
        'clinic-123',
        'patient-456',
        'note-789',
        'attach-abc',
        'file with spaces & symbols!.pdf'
      );

      expect(result).toBe(
        'clinic/clinic-123/patient/patient-456/note/note-789/attach-abc/file_with_spaces___symbols_.pdf'
      );
    });

    it('should preserve valid characters in file names', () => {
      const result = buildS3Key(
        'clinic-123',
        'patient-456',
        'note-789',
        'attach-abc',
        'valid-file_name.2024.pdf'
      );

      expect(result).toBe(
        'clinic/clinic-123/patient/patient-456/note/note-789/attach-abc/valid-file_name.2024.pdf'
      );
    });
  });

  describe('round-trip', () => {
    it('should successfully round-trip PK', () => {
      const clinicId = 'clinic-abc-123';
      const patientId = 'patient-xyz-789';

      const pk = buildPK(clinicId, patientId);
      const parsed = parsePK(pk);

      expect(parsed.clinicId).toBe(clinicId);
      expect(parsed.patientId).toBe(patientId);
    });

    it('should successfully round-trip SK', () => {
      const studyDate = '2024-06-15';
      const noteId = 'note-uuid-12345';

      const sk = buildSK(studyDate, noteId);
      const parsed = parseSK(sk);

      expect(parsed.studyDate).toBe(studyDate);
      expect(parsed.noteId).toBe(noteId);
    });
  });

  describe('buildClinicPK', () => {
    it('should build a valid clinic partition key', () => {
      const result = buildClinicPK('clinic-123');

      expect(result).toBe('CLINIC#clinic-123');
    });
  });

  describe('buildClinicSK', () => {
    it('should return METADATA', () => {
      const result = buildClinicSK();

      expect(result).toBe('METADATA');
    });
  });

  describe('buildPatientPK', () => {
    it('should build a valid patient partition key', () => {
      const result = buildPatientPK('clinic-123', 'patient-456');

      expect(result).toBe('CLINIC#clinic-123#PATIENT#patient-456');
    });
  });

  describe('buildPatientSK', () => {
    it('should return METADATA', () => {
      const result = buildPatientSK();

      expect(result).toBe('METADATA');
    });
  });

  describe('buildUserPK', () => {
    it('should build a valid user partition key', () => {
      const result = buildUserPK('clinic-123', 'user-789');

      expect(result).toBe('CLINIC#clinic-123#USER#user-789');
    });
  });

  describe('buildUserSK', () => {
    it('should return METADATA', () => {
      const result = buildUserSK();

      expect(result).toBe('METADATA');
    });
  });
});
