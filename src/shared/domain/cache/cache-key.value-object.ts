export class CacheKey {
  private readonly value: string;

  constructor(key: string) {
    if (!key || key.trim().length === 0) {
      throw new Error('Cache key cannot be empty');
    }

    if (key.length > 512) {
      throw new Error('Cache key cannot exceed 512 characters');
    }

    this.value = key.trim();
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }

  public equals(other: CacheKey): boolean {
    return this.value === other.value;
  }

  public withPrefix(prefix: string): CacheKey {
    return new CacheKey(`${prefix}:${this.value}`);
  }

  public withNamespace(namespace: string): CacheKey {
    return new CacheKey(`${namespace}:${this.value}`);
  }
}
