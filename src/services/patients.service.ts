import { AuthContext, Scope } from '../types/auth';
import { requireScopes } from '../lib/auth';
import { logger } from '../lib/logger';
import * as patientsRepository from '../data/patients.repository';
import { Patient } from '../data/patients.repository';

export interface PatientDTO {
  patientId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'archived';
}

function toPatientDTO(patient: Patient): PatientDTO {
  return {
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    email: patient.email,
    phone: patient.phone,
    status: patient.status,
  };
}

export async function listPatients(auth: AuthContext): Promise<PatientDTO[]> {
  requireScopes(auth, Scope.NOTES_READ);

  logger.info('Listing patients for clinic', { clinicId: auth.clinicId });

  const patients = await patientsRepository.listByClinic(auth.clinicId);

  // Filter to only active patients by default
  const activePatients = patients.filter((p) => p.status === 'active');

  return activePatients.map(toPatientDTO);
}
