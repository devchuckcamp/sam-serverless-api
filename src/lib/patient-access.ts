import { AuthContext } from '../types/auth';
import { ForbiddenError } from './errors';
import { logger } from './logger';
import * as patientsRepository from '../data/patients.repository';

/**
 * Validates that the patient belongs to the user's clinic.
 * Throws ForbiddenError if the patient doesn't exist in the clinic.
 *
 * @param auth - The authenticated user's context
 * @param patientId - The patient ID to validate access for
 * @throws ForbiddenError if patient not found or not in user's clinic
 */
export async function assertPatientAccess(
  auth: AuthContext,
  patientId: string
): Promise<void> {
  const patient = await patientsRepository.findById(auth.clinicId, patientId);

  if (!patient) {
    logger.warn('Patient access denied', {
      userId: auth.userId,
      clinicId: auth.clinicId,
      patientId,
    });
    throw new ForbiddenError('Patient not found or access denied');
  }
}
