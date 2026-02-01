import { ZodError, ZodIssue, ZodIssueCode } from 'zod';
import { success, created, noContent, error, redirect } from '../../../src/lib/response';
import { ValidationError, NotFoundError, ForbiddenError, UnauthorizedError, InternalError } from '../../../src/lib/errors';

// Mock the logger to avoid console output during tests
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

describe('response utilities', () => {
  describe('success', () => {
    it('should return a 200 response with data', () => {
      const data = { id: 1, name: 'Test' };
      const result = success(data);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body as string)).toEqual({ data });
    });

    it('should include default headers', () => {
      const result = success({ test: true });

      expect(result.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      }));
    });

    it('should merge custom headers', () => {
      const customHeaders = { 'X-Custom-Header': 'custom-value' };
      const result = success({ test: true }, customHeaders);

      expect(result.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      }));
    });

    it('should handle complex data structures', () => {
      const data = {
        items: [{ id: 1 }, { id: 2 }],
        pagination: { cursor: 'abc', hasMore: true },
      };
      const result = success(data);

      expect(JSON.parse(result.body as string)).toEqual({ data });
    });

    it('should handle null data', () => {
      const result = success(null);

      expect(JSON.parse(result.body as string)).toEqual({ data: null });
    });

    it('should handle empty array data', () => {
      const result = success([]);

      expect(JSON.parse(result.body as string)).toEqual({ data: [] });
    });
  });

  describe('created', () => {
    it('should return a 201 response with data', () => {
      const data = { id: 'new-id', created: true };
      const result = created(data);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body as string)).toEqual({ data });
    });

    it('should include default headers', () => {
      const result = created({ id: 1 });

      expect(result.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }));
    });

    it('should merge custom headers', () => {
      const customHeaders = { 'Location': '/items/123' };
      const result = created({ id: 123 }, customHeaders);

      expect(result.headers).toEqual(expect.objectContaining({
        'Location': '/items/123',
      }));
    });
  });

  describe('noContent', () => {
    it('should return a 204 response with no body', () => {
      const result = noContent();

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeUndefined();
    });

    it('should include default headers', () => {
      const result = noContent();

      expect(result.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }));
    });
  });

  describe('error', () => {
    it('should handle ZodError', () => {
      const zodIssues: ZodIssue[] = [
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
        },
      ];
      const zodError = new ZodError(zodIssues);
      const result = error(zodError);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.details).toEqual(zodIssues);
    });

    it('should handle ValidationError', () => {
      const validationError = new ValidationError('Invalid input', { field: 'name' });
      const result = error(validationError);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Invalid input');
      expect(body.error.details).toEqual({ field: 'name' });
    });

    it('should handle ValidationError without details', () => {
      const validationError = new ValidationError('Invalid input');
      const result = error(validationError);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeUndefined();
    });

    it('should handle NotFoundError', () => {
      const notFoundError = new NotFoundError('Note', 'note-123');
      const result = error(notFoundError);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Note not found: note-123');
    });

    it('should handle ForbiddenError', () => {
      const forbiddenError = new ForbiddenError('Access denied to resource');
      const result = error(forbiddenError);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Access denied to resource');
    });

    it('should handle UnauthorizedError', () => {
      const unauthorizedError = new UnauthorizedError('Invalid token');
      const result = error(unauthorizedError);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Invalid token');
    });

    it('should handle InternalError', () => {
      const internalError = new InternalError('Database connection failed');
      const result = error(internalError);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Database connection failed');
    });

    it('should handle generic Error as 500', () => {
      const genericError = new Error('Something went wrong');
      const result = error(genericError);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('should handle string error as 500', () => {
      const result = error('Something went wrong');

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('should handle undefined error as 500', () => {
      const result = error(undefined);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle null error as 500', () => {
      const result = error(null);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body as string);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should include default headers on error response', () => {
      const result = error(new Error('Test'));

      expect(result.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }));
    });
  });

  describe('redirect', () => {
    it('should return a 302 redirect by default', () => {
      const result = redirect('https://example.com');

      expect(result.statusCode).toBe(302);
      expect(result.headers).toEqual(expect.objectContaining({
        Location: 'https://example.com',
      }));
    });

    it('should return a 301 redirect when specified', () => {
      const result = redirect('https://example.com', 301);

      expect(result.statusCode).toBe(301);
      expect(result.headers).toEqual(expect.objectContaining({
        Location: 'https://example.com',
      }));
    });

    it('should return a 302 redirect when specified', () => {
      const result = redirect('https://example.com', 302);

      expect(result.statusCode).toBe(302);
    });

    it('should include default headers along with Location', () => {
      const result = redirect('https://example.com');

      expect(result.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        Location: 'https://example.com',
      }));
    });
  });
});
