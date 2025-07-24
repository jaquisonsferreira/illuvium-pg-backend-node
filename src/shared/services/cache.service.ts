import { Injectable } from '@nestjs/common';

@Injectable()
export class CacheService {
  private cache = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    const value = this.cache.get(key);
    return value !== undefined ? value : null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    this.cache.set(key, value);
    // In a real implementation, we would set up TTL expiry
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl * 1000);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async ttl(key: string): Promise<number> {
    // Stub implementation
    return this.cache.has(key) ? 3600 : -1;
  }

  async flushAll(): Promise<void> {
    this.cache.clear();
  }
}
