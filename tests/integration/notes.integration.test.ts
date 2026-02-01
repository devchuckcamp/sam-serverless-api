// Setup environment before importing modules that use it
process.env.IS_LOCAL = 'true';
process.env.TABLE_NAME = 'SnoreMDNotes-test';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.AWS_REGION = 'us-east-1';
process.env.LOG_LEVEL = 'error';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DeleteTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import * as notesRepository from '../../src/data/notes.repository';
import { ConflictError, NotFoundError } from '../../src/lib/errors';

const TABLE_NAME = process.env.TABLE_NAME || 'SnoreMDNotes-test';
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';

const dynamoDbClient = new DynamoDBClient({
  endpoint: DYNAMODB_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

async function createTestTable(): Promise<void> {
  try {
    await dynamoDbClient.send(
      new DescribeTableCommand({ TableName: TABLE_NAME })
    );
    // Table exists, delete it first
    await dynamoDbClient.send(
      new DeleteTableCommand({ TableName: TABLE_NAME })
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch {
    // Table doesn't exist, which is fine
  }

  await dynamoDbClient.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  // Wait for table to be active
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function clearTable(): Promise<void> {
  const scanResult = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'PK, SK',
    })
  );

  for (const item of scanResult.Items ?? []) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: item['PK'], SK: item['SK'] },
      })
    );
  }
}

describe('Notes Repository Integration Tests', () => {
  const clinicId = 'clinic-integration-test';
  const patientId = 'patient-integration-test';
  const userId = 'user-integration-test';
  const username = 'Dr. Integration Test';

  beforeAll(async () => {
    process.env.TABLE_NAME = TABLE_NAME;
    process.env.DYNAMODB_ENDPOINT = DYNAMODB_ENDPOINT;
    await createTestTable();
  }, 30000);

  afterAll(async () => {
    try {
      await dynamoDbClient.send(
        new DeleteTableCommand({ TableName: TABLE_NAME })
      );
    } catch {
      // Ignore cleanup errors
    }
    dynamoDbClient.destroy();
  });

  beforeEach(async () => {
    await clearTable();
  });

  describe('create', () => {
    it('should create a note successfully', async () => {
      const input = {
        studyDate: '2024-01-15',
        title: 'Test Note',
        content: 'Test content for integration test.',
      };

      const result = await notesRepository.create(clinicId, patientId, userId, username, input);

      expect(result.noteId).toBeDefined();
      expect(result.clinicId).toBe(clinicId);
      expect(result.patientId).toBe(patientId);
      expect(result.studyDate).toBe('2024-01-15');
      expect(result.title).toBe('Test Note');
      expect(result.content).toBe('Test content for integration test.');
      expect(result.version).toBe(1);
      expect(result.createdBy).toBe(userId);
      expect(result.updatedBy).toBe(userId);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create a note with attachments', async () => {
      const input = {
        studyDate: '2024-01-15',
        title: 'Note with Attachment',
        content: 'Content',
        attachments: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            fileName: 'test.pdf',
            contentType: 'application/pdf',
            sizeBytes: 1024,
            s3Key: 'clinic/c1/patient/p1/note/n1/a1/test.pdf',
            uploadedAt: new Date().toISOString(),
          },
        ],
      };

      const result = await notesRepository.create(clinicId, patientId, userId, username, input);

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]?.fileName).toBe('test.pdf');
    });
  });

  describe('findByIdWithoutStudyDate', () => {
    it('should find an existing note by noteId', async () => {
      const input = {
        studyDate: '2024-01-15',
        title: 'Test Note',
        content: 'Content',
      };
      const created = await notesRepository.create(clinicId, patientId, userId, username, input);

      const found = await notesRepository.findByIdWithoutStudyDate(
        clinicId,
        patientId,
        created.noteId
      );

      expect(found).not.toBeNull();
      expect(found?.noteId).toBe(created.noteId);
      expect(found?.title).toBe('Test Note');
    });

    it('should return null for non-existent note', async () => {
      const found = await notesRepository.findByIdWithoutStudyDate(
        clinicId,
        patientId,
        'non-existent-id'
      );

      expect(found).toBeNull();
    });

    it('should not find soft-deleted notes', async () => {
      const input = {
        studyDate: '2024-01-15',
        title: 'To Be Deleted',
        content: 'Content',
      };
      const created = await notesRepository.create(clinicId, patientId, userId, username, input);
      await notesRepository.softDelete(
        clinicId,
        patientId,
        created.noteId,
        created.studyDate,
        userId
      );

      const found = await notesRepository.findByIdWithoutStudyDate(
        clinicId,
        patientId,
        created.noteId
      );

      expect(found).toBeNull();
    });

    it('should not find notes from different clinic', async () => {
      const input = {
        studyDate: '2024-01-15',
        title: 'Test Note',
        content: 'Content',
      };
      const created = await notesRepository.create(clinicId, patientId, userId, username, input);

      const found = await notesRepository.findByIdWithoutStudyDate(
        'different-clinic',
        patientId,
        created.noteId
      );

      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list notes for a patient', async () => {
      await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'Note 1',
        content: 'Content 1',
      });
      await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-16',
        title: 'Note 2',
        content: 'Content 2',
      });

      const result = await notesRepository.list(clinicId, patientId, { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should paginate results', async () => {
      for (let i = 1; i <= 5; i++) {
        await notesRepository.create(clinicId, patientId, userId, username, {
          studyDate: `2024-01-${String(i).padStart(2, '0')}`,
          title: `Note ${i}`,
          content: `Content ${i}`,
        });
      }

      const page1 = await notesRepository.list(clinicId, patientId, { limit: 2 });

      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await notesRepository.list(clinicId, patientId, {
        limit: 2,
        cursor: page1.nextCursor,
      });

      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(true);

      const page3 = await notesRepository.list(clinicId, patientId, {
        limit: 2,
        cursor: page2.nextCursor,
      });

      expect(page3.items).toHaveLength(1);
      expect(page3.hasMore).toBe(false);
    });

    it('should filter by study date range', async () => {
      await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-10',
        title: 'Early',
        content: 'Content',
      });
      await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'Middle',
        content: 'Content',
      });
      await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-20',
        title: 'Late',
        content: 'Content',
      });

      const result = await notesRepository.list(clinicId, patientId, {
        limit: 10,
        studyDateFrom: '2024-01-12',
        studyDateTo: '2024-01-18',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.title).toBe('Middle');
    });

    it('should not list soft-deleted notes', async () => {
      const created = await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'To Delete',
        content: 'Content',
      });
      await notesRepository.softDelete(
        clinicId,
        patientId,
        created.noteId,
        created.studyDate,
        userId
      );

      const result = await notesRepository.list(clinicId, patientId, { limit: 10 });

      expect(result.items).toHaveLength(0);
    });

    it('should not list notes from different clinic', async () => {
      await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'Test Note',
        content: 'Content',
      });

      const result = await notesRepository.list('different-clinic', patientId, { limit: 10 });

      expect(result.items).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update a note successfully', async () => {
      const created = await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'Original Title',
        content: 'Original content',
      });

      const updated = await notesRepository.update(
        clinicId,
        patientId,
        created.noteId,
        created.studyDate,
        userId,
        username,
        {
          title: 'Updated Title',
          content: 'Updated content',
          version: 1,
        }
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Updated content');
      expect(updated.version).toBe(2);
    });

    it('should throw ConflictError on version mismatch', async () => {
      const created = await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'Original Title',
        content: 'Original content',
      });

      // First update succeeds
      await notesRepository.update(
        clinicId,
        patientId,
        created.noteId,
        created.studyDate,
        userId,
        username,
        {
          title: 'Updated Once',
          version: 1,
        }
      );

      // Second update with stale version fails
      await expect(
        notesRepository.update(
          clinicId,
          patientId,
          created.noteId,
          created.studyDate,
          userId,
          username,
          {
            title: 'Updated Again',
            version: 1, // Stale version
          }
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should throw NotFoundError for non-existent note', async () => {
      await expect(
        notesRepository.update(
          clinicId,
          patientId,
          'non-existent-id',
          '2024-01-15',
          userId,
          username,
          {
            title: 'New Title',
            version: 1,
          }
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should allow partial updates', async () => {
      const created = await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'Original Title',
        content: 'Original content',
      });

      const updated = await notesRepository.update(
        clinicId,
        patientId,
        created.noteId,
        created.studyDate,
        userId,
        username,
        {
          title: 'Only Title Updated',
          version: 1,
        }
      );

      expect(updated.title).toBe('Only Title Updated');
      expect(updated.content).toBe('Original content'); // Unchanged
    });
  });

  describe('softDelete', () => {
    it('should soft delete a note', async () => {
      const created = await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'To Delete',
        content: 'Content',
      });

      await notesRepository.softDelete(
        clinicId,
        patientId,
        created.noteId,
        created.studyDate,
        userId
      );

      const found = await notesRepository.findByIdWithoutStudyDate(
        clinicId,
        patientId,
        created.noteId
      );
      expect(found).toBeNull();
    });

    it('should throw NotFoundError for non-existent note', async () => {
      await expect(
        notesRepository.softDelete(
          clinicId,
          patientId,
          'non-existent-id',
          '2024-01-15',
          userId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if already deleted', async () => {
      const created = await notesRepository.create(clinicId, patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'To Delete',
        content: 'Content',
      });

      await notesRepository.softDelete(
        clinicId,
        patientId,
        created.noteId,
        created.studyDate,
        userId
      );

      await expect(
        notesRepository.softDelete(
          clinicId,
          patientId,
          created.noteId,
          created.studyDate,
          userId
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('tenant isolation', () => {
    it('should not allow cross-clinic access', async () => {
      const created = await notesRepository.create('clinic-A', patientId, userId, username, {
        studyDate: '2024-01-15',
        title: 'Clinic A Note',
        content: 'Content',
      });

      // Try to find from clinic-B
      const found = await notesRepository.findByIdWithoutStudyDate(
        'clinic-B',
        patientId,
        created.noteId
      );
      expect(found).toBeNull();

      // Try to list from clinic-B
      const listed = await notesRepository.list('clinic-B', patientId, { limit: 10 });
      expect(listed.items).toHaveLength(0);
    });
  });
});
