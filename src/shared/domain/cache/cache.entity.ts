import { CacheKey } from './cache-key.value-object';
import { CacheValue } from './cache-value.value-object';

export interface CacheEntryProps {
  key: CacheKey;
  value: CacheValue;
  namespace?: string;
}

export class CacheEntry {
  private readonly key: CacheKey;
  private readonly value: CacheValue;
  private readonly namespace?: string;

  constructor(props: CacheEntryProps) {
    this.key = props.key;
    this.value = props.value;
    this.namespace = props.namespace;
  }

  public getKey(): CacheKey {
    return this.key;
  }

  public getValue(): CacheValue {
    return this.value;
  }

  public getNamespace(): string | undefined {
    return this.namespace;
  }

  public getFullKey(): CacheKey {
    if (this.namespace) {
      return this.key.withNamespace(this.namespace);
    }
    return this.key;
  }

  public isExpired(): boolean {
    return this.value.isExpired();
  }

  public clone(): CacheEntry {
    return new CacheEntry({
      key: this.key,
      value: this.value,
      namespace: this.namespace,
    });
  }

  public withNamespace(namespace: string): CacheEntry {
    return new CacheEntry({
      key: this.key,
      value: this.value,
      namespace,
    });
  }
}
