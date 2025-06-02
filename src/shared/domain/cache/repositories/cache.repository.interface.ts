import { CacheKey } from '../cache-key.value-object';
import { CacheValue } from '../cache-value.value-object';

export interface CacheRepositoryInterface {
  set<T>(key: CacheKey, value: CacheValue<T>): Promise<void>;
  get<T>(key: CacheKey): Promise<CacheValue<T> | null>;
  delete(key: CacheKey): Promise<boolean>;
  exists(key: CacheKey): Promise<boolean>;
  clear(): Promise<void>;
  increment(key: CacheKey, value?: number): Promise<number>;
  decrement(key: CacheKey, value?: number): Promise<number>;
  getKeys(pattern: string): Promise<CacheKey[]>;
  getWithPattern<T>(pattern: string): Promise<Map<string, CacheValue<T>>>;
  setMultiple<T>(entries: Map<CacheKey, CacheValue<T>>): Promise<void>;
  getMultiple<T>(keys: CacheKey[]): Promise<Map<string, CacheValue<T>>>;
  deleteMultiple(keys: CacheKey[]): Promise<number>;
  ping(): Promise<string>;
  flushDatabase(): Promise<void>;
}
