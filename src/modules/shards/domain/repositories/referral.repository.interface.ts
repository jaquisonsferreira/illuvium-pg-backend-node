import { ReferralEntity } from '../entities/referral.entity';

export interface IReferralRepository {
  findById(id: string): Promise<ReferralEntity | null>;

  findByRefereeAndSeason(
    refereeAddress: string,
    seasonId: number,
  ): Promise<ReferralEntity | null>;

  findByReferrerAndSeason(
    referrerAddress: string,
    seasonId: number,
  ): Promise<ReferralEntity[]>;

  findActiveByReferrer(
    referrerAddress: string,
    seasonId: number,
  ): Promise<ReferralEntity[]>;

  countByReferrerAndSeason(
    referrerAddress: string,
    seasonId: number,
  ): Promise<number>;

  countActiveByReferrerAndSeason(
    referrerAddress: string,
    seasonId: number,
  ): Promise<number>;

  create(entity: ReferralEntity): Promise<ReferralEntity>;

  update(entity: ReferralEntity): Promise<ReferralEntity>;

  findPendingActivations(
    seasonId: number,
    minShards: number,
  ): Promise<ReferralEntity[]>;

  findExpiringBonuses(
    seasonId: number,
    expiryDate: Date,
  ): Promise<ReferralEntity[]>;

  getTotalReferralShardsByReferrer(
    referrerAddress: string,
    seasonId: number,
  ): Promise<number>;
}
