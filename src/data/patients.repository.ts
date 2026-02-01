import { PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client';
import { buildPatientPK, buildPatientSK } from './keys';

export interface Patient {
  patientId: string;
  clinicId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  insuranceProvider?: string;
  insuranceId?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive' | 'archived';
}

interface DynamoDBPatientItem {
  PK: string;
  SK: string;
  patientId: string;
  clinicId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  insuranceProvider?: string;
  insuranceId?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  entityType: string;
  GSI1PK?: string;
  GSI1SK?: string;
}

function toPatient(item: DynamoDBPatientItem): Patient {
  return {
    patientId: item.patientId,
    clinicId: item.clinicId,
    firstName: item.firstName,
    lastName: item.lastName,
    dateOfBirth: item.dateOfBirth,
    gender: item.gender,
    email: item.email,
    phone: item.phone,
    address: item.address,
    insuranceProvider: item.insuranceProvider,
    insuranceId: item.insuranceId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    status: item.status as 'active' | 'inactive' | 'archived',
  };
}

export async function create(
  patient: Omit<Patient, 'createdAt' | 'updatedAt'>
): Promise<Patient> {
  const now = new Date().toISOString();
  const pk = buildPatientPK(patient.clinicId, patient.patientId);
  const sk = buildPatientSK();

  const item: DynamoDBPatientItem = {
    PK: pk,
    SK: sk,
    patientId: patient.patientId,
    clinicId: patient.clinicId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    email: patient.email,
    phone: patient.phone,
    address: patient.address,
    insuranceProvider: patient.insuranceProvider,
    insuranceId: patient.insuranceId,
    createdAt: now,
    updatedAt: now,
    status: patient.status || 'active',
    entityType: 'PATIENT',
    GSI1PK: `CLINIC#${patient.clinicId}#PATIENTS`,
    GSI1SK: `PATIENT#${patient.patientId}`,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  );

  return toPatient(item);
}

export async function findById(
  clinicId: string,
  patientId: string
): Promise<Patient | null> {
  const pk = buildPatientPK(clinicId, patientId);
  const sk = buildPatientSK();

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
    })
  );

  if (!result.Item) {
    return null;
  }

  return toPatient(result.Item as DynamoDBPatientItem);
}

export async function listByClinic(clinicId: string): Promise<Patient[]> {
  // Scan with filter for patients belonging to this clinic
  // Note: In production, add GSI1 for efficient queries
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'clinicId = :clinicId AND entityType = :entityType',
      ExpressionAttributeValues: {
        ':clinicId': clinicId,
        ':entityType': 'PATIENT',
      },
    })
  );

  const patientItems = (result.Items || []) as DynamoDBPatientItem[];
  return patientItems.map(toPatient);
}
