export interface CacheValueMetadata {
  createdAt: Date;
  ttl?: number;
  type: 'string' | 'object' | 'number' | 'boolean';
}

export class CacheValue<T = any> {
  private readonly data: T;
  private readonly metadata: CacheValueMetadata;

  constructor(data: T, ttl?: number) {
    this.data = data;
    this.metadata = {
      createdAt: new Date(),
      ttl,
      type: this.determineType(data),
    };
  }

  public getData(): T {
    return this.data;
  }

  public getMetadata(): CacheValueMetadata {
    return { ...this.metadata };
  }

  public getTtl(): number | undefined {
    return this.metadata.ttl;
  }

  public getCreatedAt(): Date {
    return this.metadata.createdAt;
  }

  public isExpired(): boolean {
    if (!this.metadata.ttl) {
      return false;
    }

    const now = new Date();
    const expirationTime = new Date(
      this.metadata.createdAt.getTime() + this.metadata.ttl * 1000,
    );

    return now > expirationTime;
  }

  public serialize(): string {
    return JSON.stringify({
      data: this.data,
      metadata: {
        ...this.metadata,
        createdAt: this.metadata.createdAt.toISOString(),
      },
    });
  }

  public static deserialize<T>(serialized: string): CacheValue<T> {
    try {
      const parsed = JSON.parse(serialized);
      const value = new CacheValue<T>(parsed.data, parsed.metadata.ttl);
      value.metadata.createdAt = new Date(parsed.metadata.createdAt);
      return value;
    } catch (error) {
      throw new Error(`Failed to deserialize cache value: ${error.message}`);
    }
  }

  public withTtl(ttl: number): CacheValue<T> {
    return new CacheValue(this.data, ttl);
  }

  private determineType(data: T): CacheValueMetadata['type'] {
    if (typeof data === 'string') return 'string';
    if (typeof data === 'number') return 'number';
    if (typeof data === 'boolean') return 'boolean';
    return 'object';
  }
}
