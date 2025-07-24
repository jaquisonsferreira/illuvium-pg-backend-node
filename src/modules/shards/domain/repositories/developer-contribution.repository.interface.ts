import {
  DeveloperContributionEntity,
  DeveloperActionType,
} from '../entities/developer-contribution.entity';

export interface IDeveloperContributionRepository {
  findById(id: string): Promise<DeveloperContributionEntity | null>;

  findByWallet(
    walletAddress: string,
    seasonId?: number,
  ): Promise<DeveloperContributionEntity[]>;

  findByWalletAndDate(
    walletAddress: string,
    date: Date,
  ): Promise<DeveloperContributionEntity[]>;

  findBySeason(
    seasonId: number,
    verified?: boolean,
    distributed?: boolean,
  ): Promise<DeveloperContributionEntity[]>;

  findUnverified(seasonId: number): Promise<DeveloperContributionEntity[]>;

  findVerifiedUndistributed(
    seasonId: number,
  ): Promise<DeveloperContributionEntity[]>;

  findByActionType(
    actionType: DeveloperActionType,
    seasonId: number,
  ): Promise<DeveloperContributionEntity[]>;

  create(
    entity: DeveloperContributionEntity,
  ): Promise<DeveloperContributionEntity>;

  update(
    entity: DeveloperContributionEntity,
  ): Promise<DeveloperContributionEntity>;

  createBatch(entities: DeveloperContributionEntity[]): Promise<void>;

  getTotalShardsByWallet(
    walletAddress: string,
    seasonId: number,
    distributedOnly?: boolean,
  ): Promise<number>;

  getStatsBySeason(seasonId: number): Promise<{
    totalContributions: number;
    verifiedContributions: number;
    distributedContributions: number;
    totalShardsEarned: number;
    byActionType: Record<
      DeveloperActionType,
      {
        count: number;
        totalShards: number;
      }
    >;
  }>;

  checkDuplicateContribution(
    walletAddress: string,
    actionType: DeveloperActionType,
    actionDetails: Record<string, any>,
    seasonId: number,
  ): Promise<boolean>;
}
