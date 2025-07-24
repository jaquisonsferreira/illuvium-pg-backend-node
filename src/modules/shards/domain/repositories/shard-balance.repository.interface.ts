import { ShardBalanceEntity } from '../entities/shard-balance.entity';

export interface IShardBalanceRepository {
  findById(id: string): Promise<ShardBalanceEntity | null>;

  findByWalletAndSeason(
    walletAddress: string,
    seasonId: number,
  ): Promise<ShardBalanceEntity | null>;

  findByWallet(walletAddress: string): Promise<ShardBalanceEntity[]>;

  findBySeason(seasonId: number): Promise<ShardBalanceEntity[]>;

  findTopBySeason(
    seasonId: number,
    limit: number,
    offset: number,
    category?: 'total' | 'staking' | 'social' | 'developer' | 'referral',
  ): Promise<{ balances: ShardBalanceEntity[]; total: number }>;

  create(entity: ShardBalanceEntity): Promise<ShardBalanceEntity>;

  update(entity: ShardBalanceEntity): Promise<ShardBalanceEntity>;

  upsert(entity: ShardBalanceEntity): Promise<ShardBalanceEntity>;

  getTotalParticipantsBySeason(seasonId: number): Promise<number>;

  getTotalShardsIssuedBySeason(seasonId: number): Promise<number>;

  getWalletRank(
    walletAddress: string,
    seasonId: number,
    category?: 'total' | 'staking' | 'social' | 'developer' | 'referral',
  ): Promise<number>;

  searchByWallet(
    searchTerm: string,
    seasonId: number,
    limit: number,
  ): Promise<ShardBalanceEntity[]>;
}
