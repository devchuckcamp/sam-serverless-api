import { ForbiddenError } from '../../../src/lib/errors';
import * as patientsService from '../../../src/services/patients.service';
import * as patientsRepository from '../../../src/data/patients.repository';
import { createMockAuthContext, createReadOnlyAuthContext } from '../../fixtures/auth';

// Mock dependencies
jest.mock('../../../src/data/patients.repository');
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

const mockedRepository = patientsRepository as jest.Mocked<typeof patientsRepository>;

describe('patientsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listPatients', () => {
    it('should return active patients for a clinic', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-abc' });
      const mockPatients: patientsRepository.Patient[] = [
        {
          patientId: 'patient-1',
          clinicId: 'clinic-abc',
          firstName: 'John',
          lastName: 'Doe',
          status: 'active',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        {
          patientId: 'patient-2',
          clinicId: 'clinic-abc',
          firstName: 'Jane',
          lastName: 'Smith',
          status: 'active',
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
        },
      ];

      mockedRepository.listByClinic.mockResolvedValue(mockPatients);

      const result = await patientsService.listPatients(auth);

      expect(result).toHaveLength(2);
      expect(result[0]!.patientId).toBe('patient-1');
      expect(result[1]!.patientId).toBe('patient-2');
    });

    it('should filter out inactive patients', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-abc' });
      const mockPatients: patientsRepository.Patient[] = [
        {
          patientId: 'patient-1',
          clinicId: 'clinic-abc',
          firstName: 'John',
          status: 'active',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        {
          patientId: 'patient-2',
          clinicId: 'clinic-abc',
          firstName: 'Jane',
          status: 'inactive',
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
        },
        {
          patientId: 'patient-3',
          clinicId: 'clinic-abc',
          firstName: 'Bob',
          status: 'archived',
          createdAt: '2024-01-17T10:00:00.000Z',
          updatedAt: '2024-01-17T10:00:00.000Z',
        },
      ];

      mockedRepository.listByClinic.mockResolvedValue(mockPatients);

      const result = await patientsService.listPatients(auth);

      expect(result).toHaveLength(1);
      expect(result[0]!.patientId).toBe('patient-1');
    });

    it('should throw ForbiddenError when user lacks NOTES_READ scope', async () => {
      const auth = createMockAuthContext({ scopes: [] });

      await expect(patientsService.listPatients(auth)).rejects.toThrow(ForbiddenError);
    });

    it('should return empty array when no patients found', async () => {
      const auth = createMockAuthContext();
      mockedRepository.listByClinic.mockResolvedValue([]);

      const result = await patientsService.listPatients(auth);

      expect(result).toHaveLength(0);
    });

    it('should call repository with correct clinic ID', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-xyz' });
      mockedRepository.listByClinic.mockResolvedValue([]);

      await patientsService.listPatients(auth);

      expect(mockedRepository.listByClinic).toHaveBeenCalledWith('clinic-xyz');
    });

    it('should return PatientDTO without sensitive clinic data', async () => {
      const auth = createMockAuthContext();
      const mockPatients: patientsRepository.Patient[] = [
        {
          patientId: 'patient-1',
          clinicId: 'clinic-abc',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-05-15',
          gender: 'male',
          email: 'john@example.com',
          phone: '555-1234',
          address: '123 Main St',
          insuranceProvider: 'Blue Cross',
          insuranceId: 'BC-123',
          status: 'active',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ];

      mockedRepository.listByClinic.mockResolvedValue(mockPatients);

      const result = await patientsService.listPatients(auth);

      expect(result[0]).toEqual({
        patientId: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1980-05-15',
        gender: 'male',
        email: 'john@example.com',
        phone: '555-1234',
        status: 'active',
      });
      // Should not include clinicId, address, insurance in DTO
      expect(result[0]).not.toHaveProperty('clinicId');
      expect(result[0]).not.toHaveProperty('address');
      expect(result[0]).not.toHaveProperty('insuranceProvider');
      expect(result[0]).not.toHaveProperty('insuranceId');
      expect(result[0]).not.toHaveProperty('createdAt');
      expect(result[0]).not.toHaveProperty('updatedAt');
    });

    it('should allow users with NOTES_READ scope', async () => {
      const auth = createReadOnlyAuthContext();
      mockedRepository.listByClinic.mockResolvedValue([]);

      await expect(patientsService.listPatients(auth)).resolves.toEqual([]);
    });

    it('should handle patients with minimal data', async () => {
      const auth = createMockAuthContext();
      const mockPatients: patientsRepository.Patient[] = [
        {
          patientId: 'patient-1',
          clinicId: 'clinic-abc',
          status: 'active',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ];

      mockedRepository.listByClinic.mockResolvedValue(mockPatients);

      const result = await patientsService.listPatients(auth);

      expect(result[0]!.patientId).toBe('patient-1');
      expect(result[0]!.firstName).toBeUndefined();
      expect(result[0]!.lastName).toBeUndefined();
    });
  });
});
