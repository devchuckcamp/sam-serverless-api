import { NotFoundError } from '../../../src/lib/errors';
import * as clinicsService from '../../../src/services/clinics.service';
import * as clinicsRepository from '../../../src/data/clinics.repository';
import { createMockAuthContext } from '../../fixtures/auth';

// Mock dependencies
jest.mock('../../../src/data/clinics.repository');
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

const mockedRepository = clinicsRepository as jest.Mocked<typeof clinicsRepository>;

describe('clinicsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getClinic', () => {
    it('should return clinic for authenticated user', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-abc' });
      const mockClinic: clinicsRepository.Clinic = {
        clinicId: 'clinic-abc',
        name: 'Sleep Center Medical',
        address: '123 Medical Drive',
        phone: '555-1234',
        email: 'info@sleepcenter.com',
        timezone: 'America/New_York',
        status: 'active',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      mockedRepository.findById.mockResolvedValue(mockClinic);

      const result = await clinicsService.getClinic(auth);

      expect(result.clinicId).toBe('clinic-abc');
      expect(result.name).toBe('Sleep Center Medical');
      expect(result.address).toBe('123 Medical Drive');
      expect(result.phone).toBe('555-1234');
      expect(result.email).toBe('info@sleepcenter.com');
      expect(result.timezone).toBe('America/New_York');
    });

    it('should throw NotFoundError when clinic not found', async () => {
      const auth = createMockAuthContext({ clinicId: 'nonexistent' });
      mockedRepository.findById.mockResolvedValue(null);

      await expect(clinicsService.getClinic(auth)).rejects.toThrow(NotFoundError);
    });

    it('should call repository with correct clinic ID from auth', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-xyz' });
      mockedRepository.findById.mockResolvedValue({
        clinicId: 'clinic-xyz',
        name: 'Test Clinic',
        status: 'active',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      });

      await clinicsService.getClinic(auth);

      expect(mockedRepository.findById).toHaveBeenCalledWith('clinic-xyz');
    });

    it('should return ClinicDTO without internal fields', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-abc' });
      const mockClinic: clinicsRepository.Clinic = {
        clinicId: 'clinic-abc',
        name: 'Test Clinic',
        address: '123 Main St',
        phone: '555-1234',
        email: 'test@clinic.com',
        timezone: 'America/Chicago',
        status: 'active',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      mockedRepository.findById.mockResolvedValue(mockClinic);

      const result = await clinicsService.getClinic(auth);

      expect(result).toEqual({
        clinicId: 'clinic-abc',
        name: 'Test Clinic',
        address: '123 Main St',
        phone: '555-1234',
        email: 'test@clinic.com',
        timezone: 'America/Chicago',
      });
      // Should not include status, createdAt, updatedAt
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should handle clinic with minimal data', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-abc' });
      const mockClinic: clinicsRepository.Clinic = {
        clinicId: 'clinic-abc',
        name: 'Minimal Clinic',
        status: 'active',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      mockedRepository.findById.mockResolvedValue(mockClinic);

      const result = await clinicsService.getClinic(auth);

      expect(result.clinicId).toBe('clinic-abc');
      expect(result.name).toBe('Minimal Clinic');
      expect(result.address).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.timezone).toBeUndefined();
    });

    it('should handle inactive clinic', async () => {
      const auth = createMockAuthContext({ clinicId: 'clinic-inactive' });
      const mockClinic: clinicsRepository.Clinic = {
        clinicId: 'clinic-inactive',
        name: 'Inactive Clinic',
        status: 'inactive',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      mockedRepository.findById.mockResolvedValue(mockClinic);

      // Service returns clinic regardless of status - authorization should be handled elsewhere
      const result = await clinicsService.getClinic(auth);

      expect(result.clinicId).toBe('clinic-inactive');
    });
  });
});
