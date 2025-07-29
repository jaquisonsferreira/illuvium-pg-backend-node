import { Injectable, Logger, Inject } from '@nestjs/common';
import { IReferralRepository } from '../../domain/repositories/referral.repository.interface';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { ReferralEntity } from '../../domain/entities/referral.entity';
import { v4 as uuidv4 } from 'uuid';
import { REFERRAL_CONFIG } from '../../constants';

interface CreateReferralDto {
  referrerAddress: string;
  refereeAddress: string;
  seasonId: number;
}

interface ActivateReferralDto {
  referralId: string;
}

interface ReferralStatsDto {
  walletAddress: string;
  seasonId: number;
}

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalShardsEarned: number;
  referrals: Array<{
    refereeAddress: string;
    status: string;
    activationDate: Date | null;
    shardsContributed: number;
    isWithinBonusPeriod: boolean;
  }>;
}

@Injectable()
export class ManageReferralUseCase {
  private readonly logger = new Logger(ManageReferralUseCase.name);

  constructor(
    @Inject('IReferralRepository')
    private readonly referralRepository: IReferralRepository,
    @Inject('IShardBalanceRepository')
    private readonly shardBalanceRepository: IShardBalanceRepository,
  ) {}

  async createReferral(dto: CreateReferralDto): Promise<ReferralEntity> {
    const { referrerAddress, refereeAddress, seasonId } = dto;

    if (referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
      throw new Error('Cannot refer yourself');
    }

    const existingReferral =
      await this.referralRepository.findByRefereeAndSeason(
        refereeAddress,
        seasonId,
      );

    if (existingReferral) {
      throw new Error('Referee already has a referral for this season');
    }

    const referrerCount =
      await this.referralRepository.countByReferrerAndSeason(
        referrerAddress,
        seasonId,
      );

    if (referrerCount >= REFERRAL_CONFIG.MAX_REFERRALS_PER_WALLET) {
      throw new Error(
        `Referrer has reached the maximum referral limit of ${REFERRAL_CONFIG.MAX_REFERRALS_PER_WALLET}`,
      );
    }

    const refereeBalance =
      await this.shardBalanceRepository.findByWalletAndSeason(
        refereeAddress,
        seasonId,
      );

    if (refereeBalance && refereeBalance.totalShards > 0) {
      throw new Error(
        'Referee already has shard earnings and cannot be referred',
      );
    }

    const referral = new ReferralEntity(
      uuidv4(),
      referrerAddress.toLowerCase(),
      refereeAddress.toLowerCase(),
      seasonId,
      'pending',
      null,
      null,
      0,
      new Date(),
      new Date(),
    );

    return this.referralRepository.create(referral);
  }

  async getReferralInfo(dto: {
    walletAddress: string;
    seasonId: number;
  }): Promise<{
    referralsMade: number;
    totalReferralShards: number;
    referredBy: string | null;
    refereeBonusActive: boolean;
    refereeBonusExpires: string | null;
  }> {
    const { walletAddress, seasonId } = dto;

    const referralsMade =
      await this.referralRepository.countByReferrerAndSeason(
        walletAddress,
        seasonId,
      );

    const totalReferralShards =
      await this.referralRepository.getTotalReferralShardsByReferrer(
        walletAddress,
        seasonId,
      );

    const referredBy = await this.referralRepository.findByRefereeAndSeason(
      walletAddress,
      seasonId,
    );

    let refereeBonusActive = false;
    let refereeBonusExpires: string | null = null;

    if (referredBy && referredBy.status === 'active') {
      refereeBonusActive = referredBy.isWithinBonusPeriod();
      if (referredBy.activationDate) {
        const expiryDate = new Date(referredBy.activationDate);
        expiryDate.setDate(
          expiryDate.getDate() + REFERRAL_CONFIG.REFEREE_BONUS_DURATION_DAYS,
        );
        refereeBonusExpires = expiryDate.toISOString();
      }
    }

    return {
      referralsMade,
      totalReferralShards,
      referredBy: referredBy?.referrerAddress || null,
      refereeBonusActive,
      refereeBonusExpires,
    };
  }

  async getActiveReferrals(dto: {
    referrerAddress: string;
    seasonId: number;
  }): Promise<
    Array<{
      wallet: string;
      referredDate: string;
      status: string;
      shardsEarned: number;
    }>
  > {
    const { referrerAddress, seasonId } = dto;

    const referrals = await this.referralRepository.findByReferrerAndSeason(
      referrerAddress,
      seasonId,
    );

    return referrals.map((referral) => ({
      wallet: referral.refereeAddress,
      referredDate: referral.createdAt.toISOString(),
      status: referral.status,
      shardsEarned: referral.totalShardsEarned,
    }));
  }

  async activateReferral(dto: ActivateReferralDto): Promise<ReferralEntity> {
    const { referralId } = dto;

    const referral = await this.referralRepository.findById(referralId);
    if (!referral) {
      throw new Error('Referral not found');
    }

    if (referral.status !== 'pending') {
      throw new Error(`Referral is already ${referral.status}`);
    }

    const refereeBalance =
      await this.shardBalanceRepository.findByWalletAndSeason(
        referral.refereeAddress,
        referral.seasonId,
      );

    if (
      !refereeBalance ||
      refereeBalance.totalShards < REFERRAL_CONFIG.ACTIVATION_THRESHOLD
    ) {
      throw new Error(
        `Referee needs at least ${REFERRAL_CONFIG.ACTIVATION_THRESHOLD} shards to activate referral`,
      );
    }

    const activatedReferral = referral.activate(refereeBalance.totalShards);
    const updatedReferral =
      await this.referralRepository.update(activatedReferral);

    this.logger.log(
      `Activated referral ${referralId} for referee ${referral.refereeAddress}`,
    );

    return updatedReferral;
  }

  async checkAndActivatePendingReferrals(seasonId: number): Promise<number> {
    const pendingReferrals =
      await this.referralRepository.findPendingActivations(
        seasonId,
        REFERRAL_CONFIG.ACTIVATION_THRESHOLD,
      );

    let activatedCount = 0;

    for (const referral of pendingReferrals) {
      try {
        await this.activateReferral({ referralId: referral.id });
        activatedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to activate referral ${referral.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (activatedCount > 0) {
      this.logger.log(`Activated ${activatedCount} pending referrals`);
    }

    return activatedCount;
  }

  async getReferralStats(dto: ReferralStatsDto): Promise<ReferralStats> {
    const { walletAddress, seasonId } = dto;

    const referrals = await this.referralRepository.findByReferrerAndSeason(
      walletAddress,
      seasonId,
    );

    const totalShardsEarned =
      await this.referralRepository.getTotalReferralShardsByReferrer(
        walletAddress,
        seasonId,
      );

    const referralDetails = await Promise.all(
      referrals.map(async (referral) => {
        const refereeBalance =
          await this.shardBalanceRepository.findByWalletAndSeason(
            referral.refereeAddress,
            seasonId,
          );

        return {
          refereeAddress: referral.refereeAddress,
          status: referral.status,
          activationDate: referral.activationDate,
          shardsContributed: referral.totalShardsEarned,
          isWithinBonusPeriod: referral.isWithinBonusPeriod(),
          refereeBalance: refereeBalance?.totalShards,
        };
      }),
    );

    return {
      totalReferrals: referrals.length,
      activeReferrals: referrals.filter((r) => r.status === 'active').length,
      totalShardsEarned,
      referrals: referralDetails,
    };
  }

  async expireOutdatedBonuses(seasonId: number): Promise<number> {
    const expiringReferrals = await this.referralRepository.findExpiringBonuses(
      seasonId,
      new Date(),
    );

    let expiredCount = 0;

    for (const referral of expiringReferrals) {
      if (!referral.isWithinBonusPeriod()) {
        const expiredReferral = referral.expire();
        await this.referralRepository.update(expiredReferral);
        expiredCount++;

        this.logger.log(
          `Expired referral bonus for referee ${referral.refereeAddress}`,
        );
      }
    }

    return expiredCount;
  }

  async validateReferralCode(
    referralCode: string,
    seasonId: number,
  ): Promise<{
    isValid: boolean;
    reason?: string;
    referrerAddress?: string;
  }> {
    const referrerAddress = referralCode.toLowerCase();

    if (!/^0x[a-fA-F0-9]{40}$/.test(referrerAddress)) {
      return {
        isValid: false,
        reason: 'Invalid wallet address format',
      };
    }

    const referrerCount =
      await this.referralRepository.countByReferrerAndSeason(
        referrerAddress,
        seasonId,
      );

    if (referrerCount >= REFERRAL_CONFIG.MAX_REFERRALS_PER_WALLET) {
      return {
        isValid: false,
        reason: 'Referrer has reached maximum referral limit',
      };
    }

    const referrerBalance =
      await this.shardBalanceRepository.findByWalletAndSeason(
        referrerAddress,
        seasonId,
      );

    if (!referrerBalance || referrerBalance.totalShards === 0) {
      return {
        isValid: false,
        reason: 'Referrer must be an active participant with shard balance',
      };
    }

    return {
      isValid: true,
      referrerAddress,
    };
  }
}
