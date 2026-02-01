import { TooManyRequestsError } from '../../../src/lib/errors';
import { RATE_LIMITS } from '../../../src/lib/rate-limit-config';

// Mock DynamoDB client
const mockSend = jest.fn();
jest.mock('../../../src/data/client', () => ({
  docClient: {
    send: (...args: unknown[]) => mockSend(...args),
  },
  TABLE_NAME: 'TestTable',
}));

jest.mock('../../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    clearContext: jest.fn(),
    setCorrelationId: jest.fn(),
  },
}));

import {
  checkRateLimit,
  incrementRateLimit,
  enforceRateLimit,
  enforceRateLimitByIp,
} from '../../../src/lib/rate-limiter';

describe('rate-limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should return allowed true when count is below limit', async () => {
      mockSend.mockResolvedValue({ Item: { count: 5 } });

      const result = await checkRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(60);
    });

    it('should return allowed false when count equals limit', async () => {
      mockSend.mockResolvedValue({ Item: { count: 60 } });

      const result = await checkRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(60);
    });

    it('should return allowed true when no existing record (count is 0)', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await checkRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
    });

    it('should fail-open on DynamoDB error', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await checkRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
    });
  });

  describe('incrementRateLimit', () => {
    it('should return allowed true when count is at or below limit', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 10 } });

      const result = await incrementRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(60);
    });

    it('should return allowed false when count exceeds limit', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 61 } });

      const result = await incrementRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(61);
    });

    it('should fail-open on DynamoDB error', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await incrementRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
    });

    it('should include retryAfter in response', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 61 } });

      const result = await incrementRateLimit('clinic-123', RATE_LIMITS.createNote);

      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('enforceRateLimit', () => {
    it('should not throw when under limit', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 5 } });

      await expect(
        enforceRateLimit('clinic-123', RATE_LIMITS.createNote)
      ).resolves.toBeUndefined();
    });

    it('should throw TooManyRequestsError when limit exceeded', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 61 } });

      await expect(
        enforceRateLimit('clinic-123', RATE_LIMITS.createNote)
      ).rejects.toThrow(TooManyRequestsError);
    });

    it('should include retryAfter in thrown error', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 61 } });

      try {
        await enforceRateLimit('clinic-123', RATE_LIMITS.createNote);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TooManyRequestsError);
        expect((error as TooManyRequestsError).retryAfter).toBeGreaterThan(0);
      }
    });

    it('should not throw on DynamoDB error (fail-open)', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      await expect(
        enforceRateLimit('clinic-123', RATE_LIMITS.createNote)
      ).resolves.toBeUndefined();
    });
  });

  describe('enforceRateLimitByIp', () => {
    it('should enforce rate limit using IP prefix', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 5 } });

      await expect(
        enforceRateLimitByIp('192.168.1.1', RATE_LIMITS.login)
      ).resolves.toBeUndefined();
    });

    it('should handle undefined IP address', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 5 } });

      await expect(
        enforceRateLimitByIp(undefined, RATE_LIMITS.login)
      ).resolves.toBeUndefined();
    });

    it('should throw when IP exceeds login limit', async () => {
      mockSend.mockResolvedValue({ Attributes: { count: 11 } });

      await expect(
        enforceRateLimitByIp('192.168.1.1', RATE_LIMITS.login)
      ).rejects.toThrow(TooManyRequestsError);
    });
  });

  describe('RATE_LIMITS configuration', () => {
    it('should have login limit of 10 requests per minute', () => {
      expect(RATE_LIMITS.login.maxRequests).toBe(10);
      expect(RATE_LIMITS.login.windowSeconds).toBe(60);
    });

    it('should have createNote limit of 60 requests per minute', () => {
      expect(RATE_LIMITS.createNote.maxRequests).toBe(60);
      expect(RATE_LIMITS.createNote.windowSeconds).toBe(60);
    });

    it('should have read limit of 200 requests per minute', () => {
      expect(RATE_LIMITS.read.maxRequests).toBe(200);
      expect(RATE_LIMITS.read.windowSeconds).toBe(60);
    });

    it('should have presign limit of 30 requests per minute', () => {
      expect(RATE_LIMITS.presign.maxRequests).toBe(30);
      expect(RATE_LIMITS.presign.windowSeconds).toBe(60);
    });

    it('should have default limit of 100 requests per minute', () => {
      expect(RATE_LIMITS.default.maxRequests).toBe(100);
      expect(RATE_LIMITS.default.windowSeconds).toBe(60);
    });
  });
});
