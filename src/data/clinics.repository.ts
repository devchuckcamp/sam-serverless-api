import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client';
import { buildClinicPK, buildClinicSK } from './keys';

export interface Clinic {
  clinicId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive';
}

interface DynamoDBClinicItem {
  PK: string;
  SK: string;
  clinicId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  entityType: string;
}

function toClinic(item: DynamoDBClinicItem): Clinic {
  return {
    clinicId: item.clinicId,
    name: item.name,
    address: item.address,
    phone: item.phone,
    email: item.email,
    timezone: item.timezone,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    status: item.status as 'active' | 'inactive',
  };
}

export async function create(clinic: Omit<Clinic, 'createdAt' | 'updatedAt'>): Promise<Clinic> {
  const now = new Date().toISOString();
  const pk = buildClinicPK(clinic.clinicId);
  const sk = buildClinicSK();

  const item: DynamoDBClinicItem = {
    PK: pk,
    SK: sk,
    clinicId: clinic.clinicId,
    name: clinic.name,
    address: clinic.address,
    phone: clinic.phone,
    email: clinic.email,
    timezone: clinic.timezone || 'America/New_York',
    createdAt: now,
    updatedAt: now,
    status: clinic.status || 'active',
    entityType: 'CLINIC',
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  );

  return toClinic(item);
}

export async function findById(clinicId: string): Promise<Clinic | null> {
  const pk = buildClinicPK(clinicId);
  const sk = buildClinicSK();

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
    })
  );

  if (!result.Item) {
    return null;
  }

  return toClinic(result.Item as DynamoDBClinicItem);
}

export async function list(): Promise<Clinic[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'begins_with(PK, :prefix) AND SK = :sk',
      ExpressionAttributeValues: {
        ':prefix': 'CLINIC#',
        ':sk': 'METADATA',
      },
    })
  );

  // Filter to only clinic items (not patient/user items)
  const clinicItems = (result.Items || []).filter(
    (item) => item['entityType'] === 'CLINIC'
  ) as DynamoDBClinicItem[];

  return clinicItems.map(toClinic);
}
