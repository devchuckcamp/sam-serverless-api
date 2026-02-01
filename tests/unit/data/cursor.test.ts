import { encodeCursor, decodeCursor } from '../../../src/data/cursor';

describe('cursor encoding/decoding', () => {
  describe('encodeCursor', () => {
    it('should encode a valid last evaluated key to base64url', () => {
      const lastEvaluatedKey = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id-123',
      };

      const result = encodeCursor(lastEvaluatedKey);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // base64url should not contain + or /
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });

    it('should produce different cursors for different keys', () => {
      const key1 = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id-123',
      };
      const key2 = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-16#note-id-456',
      };

      const cursor1 = encodeCursor(key1);
      const cursor2 = encodeCursor(key2);

      expect(cursor1).not.toBe(cursor2);
    });
  });

  describe('decodeCursor', () => {
    it('should decode a valid cursor back to the original key', () => {
      const originalKey = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'NOTE#2024-01-15#note-id-123',
      };
      const cursor = encodeCursor(originalKey);

      const result = decodeCursor(cursor);

      expect(result).toEqual(originalKey);
    });

    it('should return undefined for invalid base64', () => {
      const result = decodeCursor('not-valid-base64!@#$');

      expect(result).toBeUndefined();
    });

    it('should return undefined for valid base64 but invalid JSON', () => {
      const invalidJson = Buffer.from('not json', 'utf-8').toString('base64url');

      const result = decodeCursor(invalidJson);

      expect(result).toBeUndefined();
    });

    it('should return undefined for valid JSON but missing PK', () => {
      const invalidData = Buffer.from(
        JSON.stringify({ SK: 'NOTE#2024-01-15#note-id' }),
        'utf-8'
      ).toString('base64url');

      const result = decodeCursor(invalidData);

      expect(result).toBeUndefined();
    });

    it('should return undefined for valid JSON but missing SK', () => {
      const invalidData = Buffer.from(
        JSON.stringify({ PK: 'CLINIC#clinic-abc#PATIENT#patient-123' }),
        'utf-8'
      ).toString('base64url');

      const result = decodeCursor(invalidData);

      expect(result).toBeUndefined();
    });

    it('should return undefined for PK not starting with CLINIC#', () => {
      const invalidData = Buffer.from(
        JSON.stringify({
          PK: 'INVALID#clinic-abc#PATIENT#patient-123',
          SK: 'NOTE#2024-01-15#note-id',
        }),
        'utf-8'
      ).toString('base64url');

      const result = decodeCursor(invalidData);

      expect(result).toBeUndefined();
    });

    it('should return undefined for SK not starting with NOTE#', () => {
      const invalidData = Buffer.from(
        JSON.stringify({
          PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
          SK: 'INVALID#2024-01-15#note-id',
        }),
        'utf-8'
      ).toString('base64url');

      const result = decodeCursor(invalidData);

      expect(result).toBeUndefined();
    });
  });

  describe('round-trip', () => {
    it('should successfully round-trip various valid keys', () => {
      const testCases = [
        {
          PK: 'CLINIC#c1#PATIENT#p1',
          SK: 'NOTE#2020-01-01#n1',
        },
        {
          PK: 'CLINIC#clinic-with-dashes#PATIENT#patient-with-dashes',
          SK: 'NOTE#2024-12-31#note-with-uuid-12345678',
        },
        {
          PK: 'CLINIC#123#PATIENT#456',
          SK: 'NOTE#2025-06-15#abc-def-ghi',
        },
      ];

      for (const originalKey of testCases) {
        const cursor = encodeCursor(originalKey);
        const decoded = decodeCursor(cursor);
        expect(decoded).toEqual(originalKey);
      }
    });
  });
});
