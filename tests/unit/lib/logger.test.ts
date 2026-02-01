import { Logger, logger } from '../../../src/lib/logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    logger.clearContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setCorrelationId', () => {
    it('should include correlation ID in log entries', () => {
      logger.setCorrelationId('corr-123');
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.correlationId).toBe('corr-123');
    });
  });

  describe('setContext', () => {
    it('should merge context into log entries', () => {
      logger.setContext({ clinicId: 'clinic-abc', userId: 'user-123' });
      logger.info('Test message');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context).toEqual({
        clinicId: 'clinic-abc',
        userId: 'user-123',
      });
    });

    it('should accumulate context across multiple setContext calls', () => {
      logger.setContext({ clinicId: 'clinic-abc' });
      logger.setContext({ userId: 'user-123' });
      logger.info('Test message');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.clinicId).toBe('clinic-abc');
      expect(logOutput.context.userId).toBe('user-123');
    });

    it('should override context values with same key', () => {
      logger.setContext({ clinicId: 'clinic-abc' });
      logger.setContext({ clinicId: 'clinic-xyz' });
      logger.info('Test message');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.clinicId).toBe('clinic-xyz');
    });
  });

  describe('clearContext', () => {
    it('should clear base context', () => {
      logger.setContext({ clinicId: 'clinic-abc' });
      logger.setCorrelationId('corr-123');
      logger.clearContext();
      logger.info('Test message');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.correlationId).toBeUndefined();
      expect(logOutput.context).toBeUndefined();
    });
  });

  describe('debug', () => {
    it('should log debug message with correct level', () => {
      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('debug');
      expect(logOutput.message).toBe('Debug message');
    });

    it('should include context in debug log', () => {
      logger.debug('Debug message', { noteId: 'note-123' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.noteId).toBe('note-123');
    });
  });

  describe('info', () => {
    it('should log info message with correct level', () => {
      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('info');
      expect(logOutput.message).toBe('Info message');
    });

    it('should include timestamp in ISO format', () => {
      logger.info('Info message');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should merge base context with log context', () => {
      logger.setContext({ clinicId: 'clinic-abc' });
      logger.info('Info message', { patientId: 'patient-123' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.clinicId).toBe('clinic-abc');
      expect(logOutput.context.patientId).toBe('patient-123');
    });
  });

  describe('warn', () => {
    it('should log warn message to console.warn', () => {
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('warn');
      expect(logOutput.message).toBe('Warning message');
    });

    it('should include context in warn log', () => {
      logger.warn('Warning', { attemptedAction: 'delete' });

      const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(logOutput.context.attemptedAction).toBe('delete');
    });
  });

  describe('error', () => {
    it('should log error message to console.error', () => {
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('error');
      expect(logOutput.message).toBe('Error message');
    });

    it('should include error details when provided', () => {
      const err = new Error('Something went wrong');
      logger.error('Error occurred', err);

      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.error.name).toBe('Error');
      expect(logOutput.error.message).toBe('Something went wrong');
      expect(logOutput.error.stack).toBeDefined();
    });

    it('should include context in error log', () => {
      logger.error('Error message', undefined, { operation: 'create' });

      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.context.operation).toBe('create');
    });

    it('should include both error and context', () => {
      const err = new Error('DB error');
      logger.error('Database failed', err, { table: 'notes' });

      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.error.message).toBe('DB error');
      expect(logOutput.context.table).toBe('notes');
    });
  });

  describe('context sanitization', () => {
    it('should redact sensitive fields containing "password"', () => {
      logger.info('Login attempt', { password: 'secret123', username: 'john' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.password).toBe('[REDACTED]');
      expect(logOutput.context.username).toBe('john');
    });

    it('should redact sensitive fields containing "token"', () => {
      logger.info('Auth', { accessToken: 'jwt-token-abc' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.accessToken).toBe('[REDACTED]');
    });

    it('should redact sensitive fields containing "secret"', () => {
      logger.info('Config', { clientSecret: 'secret-value' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.clientSecret).toBe('[REDACTED]');
    });

    it('should redact sensitive fields containing "authorization"', () => {
      logger.info('Request', { authorization: 'Bearer xyz' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.authorization).toBe('[REDACTED]');
    });

    it('should redact content field (PHI protection)', () => {
      logger.info('Note', { content: 'Patient medical data' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.content).toBe('[REDACTED]');
    });

    it('should redact title field (PHI protection)', () => {
      logger.info('Note', { title: 'Patient diagnosis' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.title).toBe('[REDACTED]');
    });

    it('should be case-insensitive when redacting', () => {
      logger.info('Auth', { PASSWORD: 'secret', Token: 'abc' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.PASSWORD).toBe('[REDACTED]');
      expect(logOutput.context.Token).toBe('[REDACTED]');
    });

    it('should not include undefined values in context', () => {
      logger.info('Test', { defined: 'value', notDefined: undefined });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.defined).toBe('value');
      expect(logOutput.context).not.toHaveProperty('notDefined');
    });
  });

  describe('child', () => {
    it('should create a child logger with inherited context', () => {
      logger.setContext({ clinicId: 'clinic-abc' });
      logger.setCorrelationId('corr-123');

      const childLogger = logger.child({ patientId: 'patient-456' });
      childLogger.info('Child log');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.correlationId).toBe('corr-123');
      expect(logOutput.context.clinicId).toBe('clinic-abc');
      expect(logOutput.context.patientId).toBe('patient-456');
    });

    it('should not affect parent logger context', () => {
      logger.setContext({ clinicId: 'clinic-abc' });

      const childLogger = logger.child({ patientId: 'patient-456' });
      childLogger.setContext({ noteId: 'note-789' });

      // Log from parent should not have child's context
      logger.info('Parent log');
      const parentOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(parentOutput.context.clinicId).toBe('clinic-abc');
      expect(parentOutput.context).not.toHaveProperty('patientId');
      expect(parentOutput.context).not.toHaveProperty('noteId');
    });

    it('should allow child to override inherited context', () => {
      logger.setContext({ userId: 'user-123' });

      const childLogger = logger.child({ userId: 'user-456' });
      childLogger.info('Child log');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context.userId).toBe('user-456');
    });
  });

  describe('exported singleton', () => {
    it('should export a Logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('log entry format', () => {
    it('should not include context key when no context provided', () => {
      logger.clearContext();
      logger.info('Simple message');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput).not.toHaveProperty('context');
    });

    it('should include all required fields in log entry', () => {
      logger.setCorrelationId('corr-123');
      logger.info('Test', { key: 'value' });

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput).toHaveProperty('timestamp');
      expect(logOutput).toHaveProperty('level');
      expect(logOutput).toHaveProperty('message');
      expect(logOutput).toHaveProperty('correlationId');
      expect(logOutput).toHaveProperty('context');
    });
  });
});
