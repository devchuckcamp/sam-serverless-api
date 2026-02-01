import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { extractOrCreateCorrelationId, getCorrelationIdHeader } from '../../../src/lib/correlation';

// Mock the logger
jest.mock('../../../src/lib/logger', () => ({
  logger: {
    setCorrelationId: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

// Mock uuid to control generated IDs
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345'),
}));

import { logger } from '../../../src/lib/logger';

describe('correlation utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractOrCreateCorrelationId', () => {
    function createMockEvent(headers?: Record<string, string>): APIGatewayProxyEventV2 {
      return {
        headers: headers ?? {},
        requestContext: {} as unknown,
        body: undefined,
        isBase64Encoded: false,
        rawPath: '/',
        rawQueryString: '',
        routeKey: 'GET /',
        version: '2.0',
      } as unknown as APIGatewayProxyEventV2;
    }

    it('should extract existing correlation ID from lowercase header', () => {
      const event = createMockEvent({ 'x-correlation-id': 'existing-id-123' });

      const result = extractOrCreateCorrelationId(event);

      expect(result).toBe('existing-id-123');
      expect(logger.setCorrelationId).toHaveBeenCalledWith('existing-id-123');
    });

    it('should extract existing correlation ID from mixed-case header', () => {
      const event = createMockEvent({ 'X-Correlation-Id': 'existing-id-456' });

      const result = extractOrCreateCorrelationId(event);

      expect(result).toBe('existing-id-456');
      expect(logger.setCorrelationId).toHaveBeenCalledWith('existing-id-456');
    });

    it('should prefer lowercase header over mixed-case', () => {
      const event = createMockEvent({
        'x-correlation-id': 'lowercase-id',
        'X-Correlation-Id': 'mixed-case-id',
      });

      const result = extractOrCreateCorrelationId(event);

      expect(result).toBe('lowercase-id');
    });

    it('should generate new UUID when no correlation ID header exists', () => {
      const event = createMockEvent({});

      const result = extractOrCreateCorrelationId(event);

      expect(result).toBe('mock-uuid-12345');
      expect(logger.setCorrelationId).toHaveBeenCalledWith('mock-uuid-12345');
    });

    it('should generate new UUID when headers is undefined', () => {
      const event = createMockEvent();
      event.headers = undefined as unknown as Record<string, string>;

      const result = extractOrCreateCorrelationId(event);

      expect(result).toBe('mock-uuid-12345');
    });

    it('should use fallback to mixed-case when lowercase is not present', () => {
      const event = createMockEvent({ 'X-Correlation-Id': 'mixed-only-id' });

      const result = extractOrCreateCorrelationId(event);

      expect(result).toBe('mixed-only-id');
    });

    it('should generate UUID if header value is empty string', () => {
      const event = createMockEvent({ 'x-correlation-id': '' });

      const result = extractOrCreateCorrelationId(event);

      // Empty string is falsy, so it should generate a new UUID
      expect(result).toBe('mock-uuid-12345');
    });
  });

  describe('getCorrelationIdHeader', () => {
    it('should return header object with correlation ID', () => {
      const result = getCorrelationIdHeader('my-correlation-id');

      expect(result).toEqual({
        'x-correlation-id': 'my-correlation-id',
      });
    });

    it('should handle empty correlation ID', () => {
      const result = getCorrelationIdHeader('');

      expect(result).toEqual({
        'x-correlation-id': '',
      });
    });

    it('should handle UUID-style correlation ID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = getCorrelationIdHeader(uuid);

      expect(result).toEqual({
        'x-correlation-id': uuid,
      });
    });

    it('should handle correlation ID with special characters', () => {
      const result = getCorrelationIdHeader('id-with-special_chars.123');

      expect(result).toEqual({
        'x-correlation-id': 'id-with-special_chars.123',
      });
    });
  });
});
