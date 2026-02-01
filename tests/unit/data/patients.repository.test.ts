import * as patientsRepository from '../../../src/data/patients.repository';

// Mock the DynamoDB client
const mockSend = jest.fn();
jest.mock('../../../src/data/client', () => ({
  docClient: {
    send: (...args: unknown[]) => mockSend(...args),
  },
  TABLE_NAME: 'TestTable',
}));

// Mock logger
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

describe('patients.repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a patient with all fields', async () => {
      mockSend.mockResolvedValue({});

      const patient = {
        patientId: 'patient-123',
        clinicId: 'clinic-abc',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1980-05-15',
        gender: 'male',
        email: 'john.doe@example.com',
        phone: '555-1234',
        address: '123 Main St',
        insuranceProvider: 'Blue Cross',
        insuranceId: 'INS-12345',
        status: 'active' as const,
      };

      const result = await patientsRepository.create(patient);

      expect(result.patientId).toBe('patient-123');
      expect(result.clinicId).toBe('clinic-abc');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.dateOfBirth).toBe('1980-05-15');
      expect(result.gender).toBe('male');
      expect(result.email).toBe('john.doe@example.com');
      expect(result.phone).toBe('555-1234');
      expect(result.address).toBe('123 Main St');
      expect(result.insuranceProvider).toBe('Blue Cross');
      expect(result.insuranceId).toBe('INS-12345');
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create a patient with minimal fields', async () => {
      mockSend.mockResolvedValue({});

      const patient = {
        patientId: 'patient-456',
        clinicId: 'clinic-abc',
        status: 'active' as const,
      };

      const result = await patientsRepository.create(patient);

      expect(result.patientId).toBe('patient-456');
      expect(result.clinicId).toBe('clinic-abc');
      expect(result.status).toBe('active');
      expect(result.firstName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
    });

    it('should default status to active if not provided', async () => {
      mockSend.mockResolvedValue({});

      const patient = {
        patientId: 'patient-789',
        clinicId: 'clinic-abc',
      } as Omit<patientsRepository.Patient, 'createdAt' | 'updatedAt'>;

      const result = await patientsRepository.create(patient);

      expect(result.status).toBe('active');
    });

    it('should use correct DynamoDB keys', async () => {
      mockSend.mockResolvedValue({});

      const patient = {
        patientId: 'patient-123',
        clinicId: 'clinic-abc',
        status: 'active' as const,
      };

      await patientsRepository.create(patient);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'TestTable',
            Item: expect.objectContaining({
              PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
              SK: 'METADATA',
              entityType: 'PATIENT',
              GSI1PK: 'CLINIC#clinic-abc#PATIENTS',
              GSI1SK: 'PATIENT#patient-123',
            }),
            ConditionExpression: 'attribute_not_exists(PK)',
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return a patient when found', async () => {
      const mockItem = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'METADATA',
        patientId: 'patient-123',
        clinicId: 'clinic-abc',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1985-03-20',
        gender: 'female',
        email: 'jane.smith@example.com',
        phone: '555-5678',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        status: 'active',
        entityType: 'PATIENT',
      };

      mockSend.mockResolvedValue({ Item: mockItem });

      const result = await patientsRepository.findById('clinic-abc', 'patient-123');

      expect(result).not.toBeNull();
      expect(result?.patientId).toBe('patient-123');
      expect(result?.firstName).toBe('Jane');
      expect(result?.lastName).toBe('Smith');
      expect(result?.status).toBe('active');
    });

    it('should return null when patient not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await patientsRepository.findById('clinic-abc', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should use correct key structure', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      await patientsRepository.findById('clinic-xyz', 'patient-789');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: {
              PK: 'CLINIC#clinic-xyz#PATIENT#patient-789',
              SK: 'METADATA',
            },
          }),
        })
      );
    });

    it('should handle patient with all optional fields', async () => {
      const mockItem = {
        PK: 'CLINIC#clinic-abc#PATIENT#patient-123',
        SK: 'METADATA',
        patientId: 'patient-123',
        clinicId: 'clinic-abc',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1980-01-01',
        gender: 'male',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        insuranceProvider: 'Aetna',
        insuranceId: 'AET-123',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        status: 'active',
        entityType: 'PATIENT',
      };

      mockSend.mockResolvedValue({ Item: mockItem });

      const result = await patientsRepository.findById('clinic-abc', 'patient-123');

      expect(result?.address).toBe('123 Main St');
      expect(result?.insuranceProvider).toBe('Aetna');
      expect(result?.insuranceId).toBe('AET-123');
    });
  });

  describe('listByClinic', () => {
    it('should return all patients for a clinic', async () => {
      const mockItems = [
        {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-1',
          SK: 'METADATA',
          patientId: 'patient-1',
          clinicId: 'clinic-abc',
          firstName: 'John',
          lastName: 'Doe',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          status: 'active',
          entityType: 'PATIENT',
        },
        {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-2',
          SK: 'METADATA',
          patientId: 'patient-2',
          clinicId: 'clinic-abc',
          firstName: 'Jane',
          lastName: 'Smith',
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          status: 'active',
          entityType: 'PATIENT',
        },
      ];

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await patientsRepository.listByClinic('clinic-abc');

      expect(result).toHaveLength(2);
      expect(result[0]!.patientId).toBe('patient-1');
      expect(result[1]!.patientId).toBe('patient-2');
    });

    it('should return empty array when no patients found', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await patientsRepository.listByClinic('clinic-empty');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when Items is undefined', async () => {
      mockSend.mockResolvedValue({ Items: undefined });

      const result = await patientsRepository.listByClinic('clinic-abc');

      expect(result).toHaveLength(0);
    });

    it('should use correct filter expression', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await patientsRepository.listByClinic('clinic-xyz');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'TestTable',
            FilterExpression: 'clinicId = :clinicId AND entityType = :entityType',
            ExpressionAttributeValues: {
              ':clinicId': 'clinic-xyz',
              ':entityType': 'PATIENT',
            },
          }),
        })
      );
    });

    it('should handle patients with different statuses', async () => {
      const mockItems = [
        {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-1',
          SK: 'METADATA',
          patientId: 'patient-1',
          clinicId: 'clinic-abc',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          status: 'active',
          entityType: 'PATIENT',
        },
        {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-2',
          SK: 'METADATA',
          patientId: 'patient-2',
          clinicId: 'clinic-abc',
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          status: 'inactive',
          entityType: 'PATIENT',
        },
        {
          PK: 'CLINIC#clinic-abc#PATIENT#patient-3',
          SK: 'METADATA',
          patientId: 'patient-3',
          clinicId: 'clinic-abc',
          createdAt: '2024-01-17T10:00:00.000Z',
          updatedAt: '2024-01-17T10:00:00.000Z',
          status: 'archived',
          entityType: 'PATIENT',
        },
      ];

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await patientsRepository.listByClinic('clinic-abc');

      expect(result).toHaveLength(3);
      expect(result[0]!.status).toBe('active');
      expect(result[1]!.status).toBe('inactive');
      expect(result[2]!.status).toBe('archived');
    });
  });
});
