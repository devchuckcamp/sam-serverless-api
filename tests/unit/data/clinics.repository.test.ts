import * as clinicsRepository from '../../../src/data/clinics.repository';

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

describe('clinics.repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a clinic with all fields', async () => {
      mockSend.mockResolvedValue({});

      const clinic = {
        clinicId: 'clinic-abc',
        name: 'Sleep Center Medical',
        address: '123 Medical Drive',
        phone: '555-1234',
        email: 'info@sleepcenter.com',
        timezone: 'America/New_York',
        status: 'active' as const,
      };

      const result = await clinicsRepository.create(clinic);

      expect(result.clinicId).toBe('clinic-abc');
      expect(result.name).toBe('Sleep Center Medical');
      expect(result.address).toBe('123 Medical Drive');
      expect(result.phone).toBe('555-1234');
      expect(result.email).toBe('info@sleepcenter.com');
      expect(result.timezone).toBe('America/New_York');
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create a clinic with minimal fields', async () => {
      mockSend.mockResolvedValue({});

      const clinic = {
        clinicId: 'clinic-xyz',
        name: 'Basic Clinic',
        status: 'active' as const,
      };

      const result = await clinicsRepository.create(clinic);

      expect(result.clinicId).toBe('clinic-xyz');
      expect(result.name).toBe('Basic Clinic');
      expect(result.address).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('should default timezone to America/New_York if not provided', async () => {
      mockSend.mockResolvedValue({});

      const clinic = {
        clinicId: 'clinic-123',
        name: 'Test Clinic',
        status: 'active' as const,
      };

      const result = await clinicsRepository.create(clinic);

      expect(result.timezone).toBe('America/New_York');
    });

    it('should default status to active if not provided', async () => {
      mockSend.mockResolvedValue({});

      const clinic = {
        clinicId: 'clinic-456',
        name: 'Test Clinic',
      } as Omit<clinicsRepository.Clinic, 'createdAt' | 'updatedAt'>;

      const result = await clinicsRepository.create(clinic);

      expect(result.status).toBe('active');
    });

    it('should use correct DynamoDB keys', async () => {
      mockSend.mockResolvedValue({});

      const clinic = {
        clinicId: 'clinic-abc',
        name: 'Test Clinic',
        status: 'active' as const,
      };

      await clinicsRepository.create(clinic);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'TestTable',
            Item: expect.objectContaining({
              PK: 'CLINIC#clinic-abc',
              SK: 'METADATA',
              entityType: 'CLINIC',
            }),
            ConditionExpression: 'attribute_not_exists(PK)',
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return a clinic when found', async () => {
      const mockItem = {
        PK: 'CLINIC#clinic-abc',
        SK: 'METADATA',
        clinicId: 'clinic-abc',
        name: 'Sleep Center Medical',
        address: '123 Medical Drive',
        phone: '555-1234',
        email: 'info@sleepcenter.com',
        timezone: 'America/New_York',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        status: 'active',
        entityType: 'CLINIC',
      };

      mockSend.mockResolvedValue({ Item: mockItem });

      const result = await clinicsRepository.findById('clinic-abc');

      expect(result).not.toBeNull();
      expect(result?.clinicId).toBe('clinic-abc');
      expect(result?.name).toBe('Sleep Center Medical');
      expect(result?.status).toBe('active');
    });

    it('should return null when clinic not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await clinicsRepository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should use correct key structure', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      await clinicsRepository.findById('clinic-xyz');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: {
              PK: 'CLINIC#clinic-xyz',
              SK: 'METADATA',
            },
          }),
        })
      );
    });

    it('should handle clinic with inactive status', async () => {
      const mockItem = {
        PK: 'CLINIC#clinic-abc',
        SK: 'METADATA',
        clinicId: 'clinic-abc',
        name: 'Inactive Clinic',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        status: 'inactive',
        entityType: 'CLINIC',
      };

      mockSend.mockResolvedValue({ Item: mockItem });

      const result = await clinicsRepository.findById('clinic-abc');

      expect(result?.status).toBe('inactive');
    });
  });

  describe('list', () => {
    it('should return all clinics', async () => {
      const mockItems = [
        {
          PK: 'CLINIC#clinic-1',
          SK: 'METADATA',
          clinicId: 'clinic-1',
          name: 'Clinic One',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          status: 'active',
          entityType: 'CLINIC',
        },
        {
          PK: 'CLINIC#clinic-2',
          SK: 'METADATA',
          clinicId: 'clinic-2',
          name: 'Clinic Two',
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          status: 'active',
          entityType: 'CLINIC',
        },
      ];

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await clinicsRepository.list();

      expect(result).toHaveLength(2);
      expect(result[0]!.clinicId).toBe('clinic-1');
      expect(result[1]!.clinicId).toBe('clinic-2');
    });

    it('should return empty array when no clinics found', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await clinicsRepository.list();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when Items is undefined', async () => {
      mockSend.mockResolvedValue({ Items: undefined });

      const result = await clinicsRepository.list();

      expect(result).toHaveLength(0);
    });

    it('should filter out non-CLINIC entity types', async () => {
      const mockItems = [
        {
          PK: 'CLINIC#clinic-1',
          SK: 'METADATA',
          clinicId: 'clinic-1',
          name: 'Clinic One',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          status: 'active',
          entityType: 'CLINIC',
        },
        {
          PK: 'CLINIC#clinic-1#PATIENT#patient-1',
          SK: 'METADATA',
          patientId: 'patient-1',
          clinicId: 'clinic-1',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          status: 'active',
          entityType: 'PATIENT',
        },
      ];

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await clinicsRepository.list();

      expect(result).toHaveLength(1);
      expect(result[0]!.clinicId).toBe('clinic-1');
      expect(result[0]!).toHaveProperty('name');
    });

    it('should use correct query expression', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await clinicsRepository.list();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'TestTable',
            KeyConditionExpression: 'begins_with(PK, :prefix) AND SK = :sk',
            ExpressionAttributeValues: {
              ':prefix': 'CLINIC#',
              ':sk': 'METADATA',
            },
          }),
        })
      );
    });
  });
});
