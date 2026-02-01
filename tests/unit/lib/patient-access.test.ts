import { ForbiddenError } from '../../../src/lib/errors';
import { assertPatientAccess } from '../../../src/lib/patient-access';
import * as patientsRepository from '../../../src/data/patients.repository';
import { createMockAuthContext } from '../../fixtures/auth';

jest.mock('../../../src/data/patients.repository');
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  },
}));

const mockedPatientsRepository = patientsRepository as jest.Mocked<typeof patientsRepository>;

describe('assertPatientAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not throw when patient exists in clinic', async () => {
    const auth = createMockAuthContext({ clinicId: 'clinic-abc' });
    mockedPatientsRepository.findById.mockResolvedValue({
      patientId: 'patient-123',
      clinicId: 'clinic-abc',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    });

    await expect(assertPatientAccess(auth, 'patient-123')).resolves.toBeUndefined();

    expect(mockedPatientsRepository.findById).toHaveBeenCalledWith('clinic-abc', 'patient-123');
  });

  it('should throw ForbiddenError when patient not found', async () => {
    const auth = createMockAuthContext({ clinicId: 'clinic-abc' });
    mockedPatientsRepository.findById.mockResolvedValue(null);

    await expect(assertPatientAccess(auth, 'patient-123')).rejects.toThrow(ForbiddenError);
    await expect(assertPatientAccess(auth, 'patient-123')).rejects.toThrow(
      'Patient not found or access denied'
    );
  });

  it('should use generic error message to avoid information disclosure', async () => {
    const auth = createMockAuthContext({ clinicId: 'clinic-a' });
    mockedPatientsRepository.findById.mockResolvedValue(null);

    try {
      await assertPatientAccess(auth, 'patient-from-clinic-b');
      fail('Expected ForbiddenError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).message).toBe('Patient not found or access denied');
      // Message should NOT reveal whether patient exists in another clinic
      expect((error as ForbiddenError).message).not.toContain('clinic-b');
      expect((error as ForbiddenError).message).not.toContain('another clinic');
    }
  });

  it('should query patient repository with correct clinicId and patientId', async () => {
    const auth = createMockAuthContext({ clinicId: 'clinic-xyz', userId: 'user-456' });
    mockedPatientsRepository.findById.mockResolvedValue({
      patientId: 'patient-789',
      clinicId: 'clinic-xyz',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    });

    await assertPatientAccess(auth, 'patient-789');

    expect(mockedPatientsRepository.findById).toHaveBeenCalledTimes(1);
    expect(mockedPatientsRepository.findById).toHaveBeenCalledWith('clinic-xyz', 'patient-789');
  });
});
