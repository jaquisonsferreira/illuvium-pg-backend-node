import { PriceHistoryEntity } from '../entities/price-history.entity';

export interface IPriceHistoryRepository {
  findById(id: string): Promise<PriceHistoryEntity | null>;

  findLatestByToken(
    tokenAddress: string,
    chain: string,
  ): Promise<PriceHistoryEntity | null>;

  findByTokenAndTimeRange(
    tokenAddress: string,
    chain: string,
    startTime: Date,
    endTime: Date,
    granularity?: string,
  ): Promise<PriceHistoryEntity[]>;

  findByTokenAndDate(
    tokenAddress: string,
    chain: string,
    date: Date,
    granularity?: string,
  ): Promise<PriceHistoryEntity | null>;

  findMultipleTokensLatest(
    tokens: Array<{ address: string; chain: string }>,
  ): Promise<PriceHistoryEntity[]>;

  create(entity: PriceHistoryEntity): Promise<PriceHistoryEntity>;

  createBatch(entities: PriceHistoryEntity[]): Promise<void>;

  upsert(entity: PriceHistoryEntity): Promise<PriceHistoryEntity>;

  deleteOlderThan(date: Date, granularity?: string): Promise<number>;

  getAveragePriceForPeriod(
    tokenAddress: string,
    chain: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number | null>;

  getHighLowForPeriod(
    tokenAddress: string,
    chain: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ high: number; low: number } | null>;
}
