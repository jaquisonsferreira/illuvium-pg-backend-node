export class PriceHistoryEntity {
  constructor(
    public readonly id: string,
    public readonly tokenAddress: string,
    public readonly chain: string,
    public readonly priceUsd: number,
    public readonly priceChange24h: number | null,
    public readonly marketCap: number | null,
    public readonly volume24h: number | null,
    public readonly timestamp: Date,
    public readonly source: string,
    public readonly granularity: string,
    public readonly createdAt: Date,
  ) {}

  static create(params: {
    tokenAddress: string;
    chain: string;
    priceUsd: number;
    priceChange24h?: number;
    marketCap?: number;
    volume24h?: number;
    timestamp: Date;
    source: string;
    granularity: string;
  }): PriceHistoryEntity {
    const id = crypto.randomUUID();
    return new PriceHistoryEntity(
      id,
      params.tokenAddress.toLowerCase(),
      params.chain,
      params.priceUsd,
      params.priceChange24h ?? null,
      params.marketCap ?? null,
      params.volume24h ?? null,
      params.timestamp,
      params.source,
      params.granularity,
      new Date(),
    );
  }

  isPriceStale(maxAgeMinutes: number): boolean {
    const ageInMinutes = (Date.now() - this.timestamp.getTime()) / (1000 * 60);
    return ageInMinutes > maxAgeMinutes;
  }

  getAgeInMinutes(): number {
    return (Date.now() - this.timestamp.getTime()) / (1000 * 60);
  }

  isSignificantPriceChange(threshold: number = 5): boolean {
    if (!this.priceChange24h) return false;
    return Math.abs(this.priceChange24h) >= threshold;
  }
}
