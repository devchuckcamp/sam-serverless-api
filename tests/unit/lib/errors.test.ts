import {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ConflictError,
  InternalError,
  isAppError,
} from '../../../src/lib/errors';

describe('AppError', () => {
  it('should create an error with correct properties', () => {
    const error = new AppError('Test error', 400, 'TEST_ERROR');

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('AppError');
    expect(error.stack).toBeDefined();
  });

  it('should create a non-operational error when specified', () => {
    const error = new AppError('Critical error', 500, 'CRITICAL', false);

    expect(error.isOperational).toBe(false);
  });

  it('should be an instance of Error', () => {
    const error = new AppError('Test', 400, 'TEST');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have a proper stack trace', () => {
    const error = new AppError('Test', 400, 'TEST');

    expect(error.stack).toContain('AppError');
    expect(error.stack).toContain('Test');
  });
});

describe('ValidationError', () => {
  it('should create a validation error with default properties', () => {
    const error = new ValidationError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('should store validation details', () => {
    const details = { field: 'email', issue: 'invalid format' };
    const error = new ValidationError('Invalid input', details);

    expect(error.details).toEqual(details);
  });

  it('should store array of validation errors', () => {
    const details = [
      { path: ['email'], message: 'Invalid email' },
      { path: ['name'], message: 'Name required' },
    ];
    const error = new ValidationError('Validation failed', details);

    expect(error.details).toEqual(details);
    expect((error.details as unknown[]).length).toBe(2);
  });

  it('should be an instance of AppError', () => {
    const error = new ValidationError('Test');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ValidationError);
  });
});

describe('NotFoundError', () => {
  it('should create a not found error with proper message', () => {
    const error = new NotFoundError('Note', 'note-123');

    expect(error.message).toBe('Note not found: note-123');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.isOperational).toBe(true);
  });

  it('should handle different resource types', () => {
    const patientError = new NotFoundError('Patient', 'patient-456');
    expect(patientError.message).toBe('Patient not found: patient-456');

    const clinicError = new NotFoundError('Clinic', 'clinic-abc');
    expect(clinicError.message).toBe('Clinic not found: clinic-abc');
  });

  it('should be an instance of AppError', () => {
    const error = new NotFoundError('Note', 'id');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe('ForbiddenError', () => {
  it('should create a forbidden error with default message', () => {
    const error = new ForbiddenError();

    expect(error.message).toBe('Access denied');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.isOperational).toBe(true);
  });

  it('should create a forbidden error with custom message', () => {
    const error = new ForbiddenError('You do not have permission');

    expect(error.message).toBe('You do not have permission');
  });

  it('should be an instance of AppError', () => {
    const error = new ForbiddenError();

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ForbiddenError);
  });
});

describe('UnauthorizedError', () => {
  it('should create an unauthorized error with default message', () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.isOperational).toBe(true);
  });

  it('should create an unauthorized error with custom message', () => {
    const error = new UnauthorizedError('Invalid token');

    expect(error.message).toBe('Invalid token');
  });

  it('should be an instance of AppError', () => {
    const error = new UnauthorizedError();

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(UnauthorizedError);
  });
});

describe('ConflictError', () => {
  it('should create a conflict error with message', () => {
    const error = new ConflictError('Version conflict');

    expect(error.message).toBe('Version conflict');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.isOperational).toBe(true);
  });

  it('should be an instance of AppError', () => {
    const error = new ConflictError('Duplicate entry');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ConflictError);
  });
});

describe('InternalError', () => {
  it('should create an internal error with default message', () => {
    const error = new InternalError();

    expect(error.message).toBe('Internal server error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(false);
  });

  it('should create an internal error with custom message', () => {
    const error = new InternalError('Database connection failed');

    expect(error.message).toBe('Database connection failed');
    expect(error.isOperational).toBe(false);
  });

  it('should be an instance of AppError', () => {
    const error = new InternalError();

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(InternalError);
  });
});

describe('isAppError', () => {
  it('should return true for AppError', () => {
    const error = new AppError('Test', 400, 'TEST');
    expect(isAppError(error)).toBe(true);
  });

  it('should return true for ValidationError', () => {
    const error = new ValidationError('Test');
    expect(isAppError(error)).toBe(true);
  });

  it('should return true for NotFoundError', () => {
    const error = new NotFoundError('Resource', 'id');
    expect(isAppError(error)).toBe(true);
  });

  it('should return true for ForbiddenError', () => {
    const error = new ForbiddenError();
    expect(isAppError(error)).toBe(true);
  });

  it('should return true for UnauthorizedError', () => {
    const error = new UnauthorizedError();
    expect(isAppError(error)).toBe(true);
  });

  it('should return true for ConflictError', () => {
    const error = new ConflictError('Test');
    expect(isAppError(error)).toBe(true);
  });

  it('should return true for InternalError', () => {
    const error = new InternalError();
    expect(isAppError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Test');
    expect(isAppError(error)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isAppError('error')).toBe(false);
  });

  it('should return false for plain object', () => {
    expect(isAppError({ message: 'error' })).toBe(false);
  });
});
