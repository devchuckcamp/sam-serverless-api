import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Note, CreateNoteInput, UpdateNoteInput, PaginatedResponse, Attachment } from '../types';
import { ConflictError, NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';
import { docClient, TABLE_NAME } from './client';
import { buildPK, buildSK } from './keys';
import { encodeCursor, decodeCursor } from './cursor';

interface DynamoDBNoteItem {
  PK: string;
  SK: string;
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
  entityType: string;
  GSI1PK?: string;
  GSI1SK?: string;
}

function itemToNote(item: DynamoDBNoteItem): Note {
  return {
    noteId: item.noteId,
    clinicId: item.clinicId,
    patientId: item.patientId,
    studyDate: item.studyDate,
    title: item.title,
    content: item.content,
    noteType: item.noteType,
    tags: item.tags ?? [],
    attachments: item.attachments ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: item.createdBy,
    createdByName: item.createdByName ?? item.createdBy,
    updatedBy: item.updatedBy,
    updatedByName: item.updatedByName ?? item.updatedBy,
    version: item.version,
    deletedAt: item.deletedAt,
    deletedBy: item.deletedBy,
  };
}

export interface ListNotesOptions {
  cursor?: string;
  limit: number;
  studyDateFrom?: string;
  studyDateTo?: string;
  tag?: string;
}

export async function create(
  clinicId: string,
  patientId: string,
  userId: string,
  username: string,
  input: CreateNoteInput
): Promise<Note> {
  const noteId = uuidv4();
  const now = new Date().toISOString();
  const pk = buildPK(clinicId, patientId);
  const sk = buildSK(input.studyDate, noteId);

  const item: DynamoDBNoteItem = {
    PK: pk,
    SK: sk,
    noteId,
    clinicId,
    patientId,
    studyDate: input.studyDate,
    title: input.title,
    content: input.content,
    noteType: input.noteType,
    tags: input.tags ?? [],
    attachments: input.attachments ?? [],
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    createdByName: username,
    updatedBy: userId,
    updatedByName: username,
    version: 1,
    entityType: 'NOTE',
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  );

  logger.info('Note created', { clinicId, patientId, noteId });
  return itemToNote(item);
}

export async function findById(
  clinicId: string,
  patientId: string,
  noteId: string,
  studyDate: string
): Promise<Note | null> {
  const pk = buildPK(clinicId, patientId);
  const sk = buildSK(studyDate, noteId);

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
    })
  );

  if (!result.Item) {
    return null;
  }

  const item = result.Item as DynamoDBNoteItem;

  if (item.deletedAt) {
    return null;
  }

  return itemToNote(item);
}

export async function findByIdWithoutStudyDate(
  clinicId: string,
  patientId: string,
  noteId: string
): Promise<Note | null> {
  const pk = buildPK(clinicId, patientId);

  // Note: Do not use Limit here - DynamoDB applies Limit BEFORE FilterExpression,
  // which would cause the query to miss items if the first scanned item doesn't match
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'noteId = :noteId AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':skPrefix': 'NOTE#',
        ':noteId': noteId,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return itemToNote(result.Items[0] as DynamoDBNoteItem);
}

export async function list(
  clinicId: string,
  patientId: string,
  options: ListNotesOptions
): Promise<PaginatedResponse<Note>> {
  const pk = buildPK(clinicId, patientId);
  const { cursor, limit, studyDateFrom, studyDateTo, tag } = options;

  let keyCondition: string;
  const expressionValues: Record<string, unknown> = {
    ':pk': pk,
  };

  if (studyDateFrom && studyDateTo) {
    keyCondition = 'PK = :pk AND SK BETWEEN :skStart AND :skEnd';
    expressionValues[':skStart'] = `NOTE#${studyDateFrom}`;
    expressionValues[':skEnd'] = `NOTE#${studyDateTo}~`;
  } else if (studyDateFrom) {
    keyCondition = 'PK = :pk AND SK >= :skStart';
    expressionValues[':skStart'] = `NOTE#${studyDateFrom}`;
  } else if (studyDateTo) {
    keyCondition = 'PK = :pk AND SK BETWEEN :skPrefix AND :skEnd';
    expressionValues[':skPrefix'] = 'NOTE#';
    expressionValues[':skEnd'] = `NOTE#${studyDateTo}~`;
  } else {
    keyCondition = 'PK = :pk AND begins_with(SK, :skPrefix)';
    expressionValues[':skPrefix'] = 'NOTE#';
  }

  // Build filter expression
  const filterConditions: string[] = ['attribute_not_exists(deletedAt)'];

  if (tag) {
    filterConditions.push('contains(tags, :tag)');
    expressionValues[':tag'] = tag;
  }

  const filterExpression = filterConditions.join(' AND ');
  const exclusiveStartKey = cursor ? decodeCursor(cursor) : undefined;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: keyCondition,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionValues,
      Limit: limit + 1,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    })
  );

  const items = (result.Items ?? []) as DynamoDBNoteItem[];
  const hasMore = items.length > limit;

  if (hasMore) {
    items.pop();
  }

  let nextCursor: string | undefined;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    if (lastItem) {
      nextCursor = encodeCursor({ PK: lastItem.PK, SK: lastItem.SK });
    }
  }

  return {
    items: items.map(itemToNote),
    nextCursor,
    hasMore,
  };
}

export async function update(
  clinicId: string,
  patientId: string,
  noteId: string,
  studyDate: string,
  userId: string,
  username: string,
  input: UpdateNoteInput
): Promise<Note> {
  const pk = buildPK(clinicId, patientId);
  const sk = buildSK(studyDate, noteId);
  const now = new Date().toISOString();

  const updateExpressions: string[] = ['updatedAt = :updatedAt', 'updatedBy = :updatedBy', 'updatedByName = :updatedByName', 'version = version + :inc'];
  const expressionValues: Record<string, unknown> = {
    ':updatedAt': now,
    ':updatedBy': userId,
    ':updatedByName': username,
    ':inc': 1,
    ':expectedVersion': input.version,
  };
  const expressionNames: Record<string, string> = {};

  if (input.title !== undefined) {
    updateExpressions.push('title = :title');
    expressionValues[':title'] = input.title;
  }

  if (input.content !== undefined) {
    updateExpressions.push('#content = :content');
    expressionValues[':content'] = input.content;
    expressionNames['#content'] = 'content';
  }

  if (input.attachments !== undefined) {
    updateExpressions.push('attachments = :attachments');
    expressionValues[':attachments'] = input.attachments;
  }

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ConditionExpression:
          'attribute_exists(PK) AND attribute_not_exists(deletedAt) AND version = :expectedVersion',
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
        ReturnValues: 'ALL_NEW',
      })
    );

    if (!result.Attributes) {
      throw new NotFoundError('Note', noteId);
    }

    logger.info('Note updated', { clinicId, patientId, noteId });
    return itemToNote(result.Attributes as DynamoDBNoteItem);
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      const existing = await findById(clinicId, patientId, noteId, studyDate);
      if (!existing) {
        throw new NotFoundError('Note', noteId);
      }
      throw new ConflictError(
        `Version conflict: expected ${input.version}, current is ${existing.version}`
      );
    }
    throw err;
  }
}

export async function softDelete(
  clinicId: string,
  patientId: string,
  noteId: string,
  studyDate: string,
  userId: string
): Promise<void> {
  const pk = buildPK(clinicId, patientId);
  const sk = buildSK(studyDate, noteId);
  const now = new Date().toISOString();

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET deletedAt = :deletedAt, deletedBy = :deletedBy',
        ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(deletedAt)',
        ExpressionAttributeValues: {
          ':deletedAt': now,
          ':deletedBy': userId,
        },
      })
    );

    logger.info('Note soft deleted', { clinicId, patientId, noteId });
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      throw new NotFoundError('Note', noteId);
    }
    throw err;
  }
}

export async function hardDelete(
  clinicId: string,
  patientId: string,
  noteId: string,
  studyDate: string
): Promise<void> {
  const pk = buildPK(clinicId, patientId);
  const sk = buildSK(studyDate, noteId);

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
    })
  );

  logger.info('Note hard deleted', { clinicId, patientId, noteId });
}
