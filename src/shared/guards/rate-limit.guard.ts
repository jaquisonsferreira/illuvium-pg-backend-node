import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SystemError } from '@shared/errors/validation.error';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: Request) => string; // Custom key generator
  skipIf?: (request: Request) => boolean; // Skip rate limiting conditionally
  message?: string; // Custom error message
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor(private reflector: Reflector) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Get rate limit options from decorator
    const options =
      this.reflector.get<RateLimitOptions>('rateLimit', context.getHandler()) ||
      this.getDefaultOptions();

    // Check if should skip rate limiting
    if (options.skipIf && options.skipIf(request)) {
      return true;
    }

    // Generate key for this request
    const key = this.generateKey(request, options.keyGenerator);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = this.store[key];
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + options.windowMs,
      };
      this.store[key] = entry;
    }

    // Increment request count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > options.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      throw new SystemError(
        'RATE_LIMIT_EXCEEDED',
        options.message || 'Too many requests',
        {
          limit: options.maxRequests,
          window_ms: options.windowMs,
          retry_after_seconds: retryAfter,
        },
        429,
      );
    }

    // Add rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', options.maxRequests);
    response.setHeader(
      'X-RateLimit-Remaining',
      options.maxRequests - entry.count,
    );
    response.setHeader(
      'X-RateLimit-Reset',
      new Date(entry.resetTime).toISOString(),
    );

    return true;
  }

  private generateKey(
    request: Request,
    customKeyGenerator?: (request: Request) => string,
  ): string {
    if (customKeyGenerator) {
      return customKeyGenerator(request);
    }

    // Default key generation: IP + user ID (if authenticated)
    const ip = this.getClientIp(request);
    const userId = (request as any).user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }

  private getClientIp(request: Request): string {
    // Check various headers for real IP (considering proxies)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }

    const real = request.headers['x-real-ip'];
    if (real) {
      return real as string;
    }

    return request.ip || request.connection.remoteAddress || 'unknown';
  }

  private getDefaultOptions(): RateLimitOptions {
    return {
      windowMs: 60000, // 1 minute
      maxRequests: 60, // 60 requests per minute
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of Object.entries(this.store)) {
      if (entry.resetTime <= now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      delete this.store[key];
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Decorator for applying rate limiting
export function RateLimit(options: RateLimitOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('rateLimit', options, descriptor.value);
    return descriptor;
  };
}
