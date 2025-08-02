export class TokenMetadataEntity {
  constructor(
    public readonly id: string,
    public readonly tokenAddress: string,
    public readonly chain: string,
    public readonly symbol: string,
    public readonly name: string,
    public readonly decimals: number,
    public readonly totalSupply: string | null,
    public readonly circulatingSupply: string | null,
    public readonly coingeckoId: string | null,
    public readonly isLpToken: boolean,
    public readonly token0Address: string | null,
    public readonly token1Address: string | null,
    public readonly poolAddress: string | null,
    public readonly dexName: string | null,
    public readonly logoUrl: string | null,
    public readonly contractType: string | null,
    public readonly isVerified: boolean,
    public readonly lastUpdated: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(params: {
    tokenAddress: string;
    chain: string;
    symbol: string;
    name: string;
    decimals: number;
    totalSupply?: string;
    circulatingSupply?: string;
    coingeckoId?: string;
    isLpToken?: boolean;
    token0Address?: string;
    token1Address?: string;
    poolAddress?: string;
    dexName?: string;
    logoUrl?: string;
    contractType?: string;
    isVerified?: boolean;
  }): TokenMetadataEntity {
    const id = crypto.randomUUID();
    const now = new Date();
    return new TokenMetadataEntity(
      id,
      params.tokenAddress.toLowerCase(),
      params.chain,
      params.symbol,
      params.name,
      params.decimals,
      params.totalSupply ?? null,
      params.circulatingSupply ?? null,
      params.coingeckoId ?? null,
      params.isLpToken ?? false,
      params.token0Address?.toLowerCase() ?? null,
      params.token1Address?.toLowerCase() ?? null,
      params.poolAddress?.toLowerCase() ?? null,
      params.dexName ?? null,
      params.logoUrl ?? null,
      params.contractType ?? null,
      params.isVerified ?? false,
      now,
      now,
      now,
    );
  }

  isStale(maxAgeDays: number): boolean {
    const ageInDays =
      (Date.now() - this.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays > maxAgeDays;
  }

  needsRefresh(maxAgeDays: number = 7): boolean {
    return this.isStale(maxAgeDays);
  }

  getLpTokenPair(): { token0: string; token1: string } | null {
    if (!this.isLpToken || !this.token0Address || !this.token1Address) {
      return null;
    }
    return {
      token0: this.token0Address,
      token1: this.token1Address,
    };
  }

  update(
    params: Partial<{
      totalSupply: string;
      circulatingSupply: string;
      logoUrl: string;
      isVerified: boolean;
    }>,
  ): TokenMetadataEntity {
    return new TokenMetadataEntity(
      this.id,
      this.tokenAddress,
      this.chain,
      this.symbol,
      this.name,
      this.decimals,
      params.totalSupply ?? this.totalSupply,
      params.circulatingSupply ?? this.circulatingSupply,
      this.coingeckoId,
      this.isLpToken,
      this.token0Address,
      this.token1Address,
      this.poolAddress,
      this.dexName,
      params.logoUrl ?? this.logoUrl,
      this.contractType,
      params.isVerified ?? this.isVerified,
      new Date(),
      this.createdAt,
      new Date(),
    );
  }
}
