import { TokenMetadataEntity } from '../entities/token-metadata.entity';

export interface ITokenMetadataRepository {
  findById(id: string): Promise<TokenMetadataEntity | null>;

  findByAddress(
    tokenAddress: string,
    chain: string,
  ): Promise<TokenMetadataEntity | null>;

  findBySymbol(symbol: string, chain?: string): Promise<TokenMetadataEntity[]>;

  findByCoingeckoId(coingeckoId: string): Promise<TokenMetadataEntity | null>;

  findLpTokens(chain?: string): Promise<TokenMetadataEntity[]>;

  findByPoolAddress(
    poolAddress: string,
    chain: string,
  ): Promise<TokenMetadataEntity | null>;

  findStaleTokens(
    lastUpdatedBefore: Date,
    limit: number,
  ): Promise<TokenMetadataEntity[]>;

  create(entity: TokenMetadataEntity): Promise<TokenMetadataEntity>;

  createBatch(entities: TokenMetadataEntity[]): Promise<void>;

  update(entity: TokenMetadataEntity): Promise<TokenMetadataEntity>;

  upsert(entity: TokenMetadataEntity): Promise<TokenMetadataEntity>;

  updateLastUpdated(
    tokenAddress: string,
    chain: string,
    timestamp: Date,
  ): Promise<void>;

  searchTokens(query: string, limit: number): Promise<TokenMetadataEntity[]>;
}
