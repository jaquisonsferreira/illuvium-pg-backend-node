import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RateLimitOptions } from './rate-limit.guard';
import { SystemError } from '@shared/errors/validation.error';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let mockContext: ExecutionContext;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RateLimitGuard(reflector);

    mockRequest = {
      ip: '192.168.1.1',
      headers: {},
      connection: { remoteAddress: '192.168.1.1' },
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getHandler: jest.fn(),
    } as any;

    // Clear the rate limit store between tests
    (guard as any).store = {};
  });

  afterEach(() => {
    if ((guard as any).cleanupInterval) {
      clearInterval((guard as any).cleanupInterval);
    }
  });

  describe('canActivate', () => {
    it('should allow requests within rate limit', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);

      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const result = await guard.canActivate(mockContext);
        expect(result).toBe(true);
      }

      // Verify headers were set correctly
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        5,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        0,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String),
      );
    });

    it('should block requests exceeding rate limit', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 2,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);

      // Make 2 requests (within limit)
      await guard.canActivate(mockContext);
      await guard.canActivate(mockContext);

      // Third request should be blocked
      await expect(guard.canActivate(mockContext)).rejects.toThrow(SystemError);
    });

    it('should use default options when none provided', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);

      // Default is 60 requests per minute
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        60,
      );
    });

    it('should reset counter after time window', async () => {
      const options: RateLimitOptions = {
        windowMs: 100, // 100ms window
        maxRequests: 1,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);

      // First request should pass
      await guard.canActivate(mockContext);

      // Second request should fail
      await expect(guard.canActivate(mockContext)).rejects.toThrow(SystemError);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next request should pass
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should skip rate limiting when skipIf returns true', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 1,
        skipIf: (req) => req.headers['x-skip-limit'] === 'true',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);
      mockRequest.headers['x-skip-limit'] = 'true';

      // Make multiple requests, all should pass
      for (let i = 0; i < 5; i++) {
        const result = await guard.canActivate(mockContext);
        expect(result).toBe(true);
      }
    });

    it('should use custom key generator', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: (req) => `custom:${req.headers['x-api-key']}`,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);

      // Requests with different keys should have separate limits
      mockRequest.headers['x-api-key'] = 'key1';
      await guard.canActivate(mockContext);
      await guard.canActivate(mockContext);

      // Change key
      mockRequest.headers['x-api-key'] = 'key2';
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should include custom error message', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 1,
        message: 'Custom rate limit message',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);

      await guard.canActivate(mockContext);

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        expect(error.message).toBe('Custom rate limit message');
      }
    });

    it('should calculate retry after correctly', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 1,
      };

      jest.spyOn(reflector, 'get').mockReturnValue(options);

      await guard.canActivate(mockContext);

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        expect(error.details.retry_after_seconds).toBeLessThanOrEqual(60);
        expect(error.details.retry_after_seconds).toBeGreaterThan(0);
      }
    });
  });

  describe('key generation', () => {
    it('should generate key from IP and user ID', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({
        windowMs: 60000,
        maxRequests: 5,
      });

      mockRequest.user = { id: 'user123' };

      await guard.canActivate(mockContext);

      const store = (guard as any).store;
      expect(Object.keys(store)).toContain('192.168.1.1:user123');
    });

    it('should use anonymous for unauthenticated requests', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({
        windowMs: 60000,
        maxRequests: 5,
      });

      await guard.canActivate(mockContext);

      const store = (guard as any).store;
      expect(Object.keys(store)).toContain('192.168.1.1:anonymous');
    });

    it('should extract IP from x-forwarded-for header', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({
        windowMs: 60000,
        maxRequests: 5,
      });

      mockRequest.headers['x-forwarded-for'] = '10.0.0.1, 192.168.1.1';

      await guard.canActivate(mockContext);

      const store = (guard as any).store;
      expect(Object.keys(store)).toContain('10.0.0.1:anonymous');
    });

    it('should extract IP from x-real-ip header', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({
        windowMs: 60000,
        maxRequests: 5,
      });

      mockRequest.headers['x-real-ip'] = '10.0.0.2';
      delete mockRequest.ip;

      await guard.canActivate(mockContext);

      const store = (guard as any).store;
      expect(Object.keys(store)).toContain('10.0.0.2:anonymous');
    });

    it('should fallback to unknown IP', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({
        windowMs: 60000,
        maxRequests: 5,
      });

      delete mockRequest.ip;
      delete mockRequest.connection.remoteAddress;

      await guard.canActivate(mockContext);

      const store = (guard as any).store;
      expect(Object.keys(store)).toContain('unknown:anonymous');
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired entries', () => {
      const now = Date.now();
      const store = (guard as any).store;

      // Add expired and active entries
      store['expired1'] = { count: 5, resetTime: now - 1000 };
      store['expired2'] = { count: 3, resetTime: now - 500 };
      store['active1'] = { count: 1, resetTime: now + 1000 };
      store['active2'] = { count: 2, resetTime: now + 2000 };

      (guard as any).cleanup();

      expect(store).toHaveProperty('active1');
      expect(store).toHaveProperty('active2');
      expect(store).not.toHaveProperty('expired1');
      expect(store).not.toHaveProperty('expired2');
    });

    it('should setup cleanup interval on construction', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      new RateLimitGuard(reflector);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear cleanup interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const interval = (guard as any).cleanupInterval;

      guard.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalledWith(interval);
    });

    it('should handle missing interval gracefully', () => {
      (guard as any).cleanupInterval = undefined;

      expect(() => guard.onModuleDestroy()).not.toThrow();
    });
  });
});
