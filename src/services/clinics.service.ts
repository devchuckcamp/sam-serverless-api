import { AuthContext } from '../types/auth';
import { NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';
import * as clinicsRepository from '../data/clinics.repository';

export interface ClinicDTO {
  clinicId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
}

export async function getClinic(auth: AuthContext): Promise<ClinicDTO> {
  logger.info('Getting clinic', { clinicId: auth.clinicId });

  const clinic = await clinicsRepository.findById(auth.clinicId);

  if (!clinic) {
    throw new NotFoundError('Clinic', auth.clinicId);
  }

  return {
    clinicId: clinic.clinicId,
    name: clinic.name,
    address: clinic.address,
    phone: clinic.phone,
    email: clinic.email,
    timezone: clinic.timezone,
  };
}
