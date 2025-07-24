import { Injectable, Logger, Inject } from '@nestjs/common';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { IShardEarningHistoryRepository } from '../../domain/repositories/shard-earning-history.repository.interface';
import { IVaultPositionRepository } from '../../domain/repositories/vault-position.repository.interface';
import { IReferralRepository } from '../../domain/repositories/referral.repository.interface';
import { IDeveloperContributionRepository } from '../../domain/repositories/developer-contribution.repository.interface';
import { ShardCalculationDomainService } from '../../domain/services/shard-calculation.domain-service';
import { AntiFraudDomainService } from '../../domain/services/anti-fraud.domain-service';
import { ShardBalanceEntity } from '../../domain/entities/shard-balance.entity';
import { ShardEarningHistoryEntity } from '../../domain/entities/shard-earning-history.entity';
import { v4 as uuidv4 } from 'uuid';

interface CalculateDailyShardsDto {
  walletAddress: string;
  seasonId: number;
  date: Date;
}

interface DailyShardCalculationResult {
  walletAddress: string;
  seasonId: number;
  date: Date;
  stakingShards: number;
  socialShards: number;
  developerShards: number;
  referralShards: number;
  totalShards: number;
  vaultBreakdown: Array<{
    vaultAddress: string;
    chain: string;
    tokenSymbol: string;
    balance: number;
    usdValue: number;
    shardsEarned: number;
  }>;
  fraudCheckResult?: {
    isSuspicious: boolean;
    reasons: string[];
  };
}

@Injectable()
export class CalculateDailyShardsUseCase {
  private readonly logger = new Logger(CalculateDailyShardsUseCase.name);

  constructor(
    @Inject('ISeasonRepository')
    private readonly seasonRepository: ISeasonRepository,
    @Inject('IShardBalanceRepository')
    private readonly shardBalanceRepository: IShardBalanceRepository,
    @Inject('IShardEarningHistoryRepository')
    private readonly shardEarningHistoryRepository: IShardEarningHistoryRepository,
    @Inject('IVaultPositionRepository')
    private readonly vaultPositionRepository: IVaultPositionRepository,
    @Inject('IReferralRepository')
    private readonly referralRepository: IReferralRepository,
    @Inject('IDeveloperContributionRepository')
    private readonly developerContributionRepository: IDeveloperContributionRepository,
    private readonly shardCalculationService: ShardCalculationDomainService,
    private readonly antiFraudService: AntiFraudDomainService,
  ) {}

  async execute(
    dto: CalculateDailyShardsDto,
  ): Promise<DailyShardCalculationResult> {
    const { walletAddress, seasonId, date } = dto;

    const season = await this.seasonRepository.findById(seasonId);
    if (!season || !season.isActive()) {
      throw new Error(`Season ${seasonId} is not active`);
    }

    const existingHistory =
      await this.shardEarningHistoryRepository.findByWalletAndDate(
        walletAddress,
        date,
        seasonId,
      );

    if (existingHistory) {
      this.logger.warn(
        `Daily shards already calculated for wallet ${walletAddress} on ${date.toISOString()}`,
      );
      return this.mapHistoryToResult(existingHistory);
    }

    const vaultPositions =
      await this.vaultPositionRepository.findByWalletAndSeason(
        walletAddress,
        seasonId,
      );

    let totalStakingShards = 0;
    const vaultBreakdown: Array<{
      vaultAddress: string;
      chain: string;
      tokenSymbol: string;
      balance: number;
      usdValue: number;
      shardsEarned: number;
    }> = [];

    for (const position of vaultPositions) {
      const stakingShards = this.shardCalculationService.calculateStakingShards(
        position.assetSymbol,
        position.usdValue,
        season,
      );

      totalStakingShards += stakingShards;
      vaultBreakdown.push({
        vaultAddress: position.vaultAddress,
        chain: position.chain,
        tokenSymbol: position.assetSymbol,
        balance: parseFloat(position.balance),
        usdValue: position.usdValue,
        shardsEarned: stakingShards,
      });
    }

    const socialShards = await this.calculateSocialShards(walletAddress, date);

    const developerContributions =
      await this.developerContributionRepository.findByWalletAndDate(
        walletAddress,
        date,
      );

    const developerShards = developerContributions
      .filter((c) => c.verified && c.distributedAt)
      .reduce((sum, c) => sum + c.shardsEarned, 0);

    let referral = await this.referralRepository.findByRefereeAndSeason(
      walletAddress,
      seasonId,
    );

    let referralBonus = 0;
    let refereeMultiplier = 1;

    if (referral && referral.isActive()) {
      const baseShards = totalStakingShards + socialShards + developerShards;
      const referralCalc = this.shardCalculationService.calculateReferralBonus(
        baseShards,
        referral,
      );
      refereeMultiplier = referralCalc.refereeMultiplier;
    }

    const activeReferrals = await this.referralRepository.findActiveByReferrer(
      walletAddress,
      seasonId,
    );

    for (const ref of activeReferrals) {
      const refereeBalance =
        await this.shardBalanceRepository.findByWalletAndSeason(
          ref.refereeAddress,
          seasonId,
        );

      if (refereeBalance) {
        const refereeHistory =
          await this.shardEarningHistoryRepository.findByWalletAndDate(
            ref.refereeAddress,
            date,
            seasonId,
          );

        if (refereeHistory) {
          const bonusCalc = this.shardCalculationService.calculateReferralBonus(
            refereeHistory.dailyTotal,
            ref,
          );
          referralBonus += bonusCalc.referrerBonus;
        }
      }
    }

    const finalCalculation =
      this.shardCalculationService.calculateTotalDailyShards({
        stakingShards: totalStakingShards,
        socialShards,
        developerShards,
        referralBonus,
        refereeMultiplier,
      });

    const fraudCheckResult = await this.antiFraudService.checkWallet(
      walletAddress,
      finalCalculation.totalShards,
      seasonId,
    );

    if (fraudCheckResult.isSuspicious) {
      this.logger.warn(
        `Suspicious activity detected for wallet ${walletAddress}: ${fraudCheckResult.reasons.join(', ')}`,
      );
    }

    const historyVaultBreakdown = vaultBreakdown.map((vault) => ({
      vaultId: vault.vaultAddress,
      asset: vault.tokenSymbol,
      chain: vault.chain,
      shardsEarned: vault.shardsEarned,
      usdValue: vault.usdValue,
    }));

    const earningHistory = new ShardEarningHistoryEntity(
      uuidv4(),
      walletAddress,
      seasonId,
      date,
      finalCalculation.stakingShards,
      finalCalculation.socialShards,
      finalCalculation.developerShards,
      finalCalculation.referralShards,
      finalCalculation.totalShards,
      historyVaultBreakdown,
      {
        refereeMultiplier,
        fraudCheckResult,
        calculatedAt: new Date().toISOString(),
      },
      new Date(),
    );

    await this.shardEarningHistoryRepository.create(earningHistory);

    const existingBalance =
      await this.shardBalanceRepository.findByWalletAndSeason(
        walletAddress,
        seasonId,
      );

    if (existingBalance) {
      let updatedBalance = existingBalance;

      if (finalCalculation.stakingShards > 0) {
        updatedBalance = updatedBalance.addShards(
          'staking',
          finalCalculation.stakingShards,
        );
      }

      if (finalCalculation.socialShards > 0) {
        updatedBalance = updatedBalance.addShards(
          'social',
          finalCalculation.socialShards,
        );
      }

      if (finalCalculation.developerShards > 0) {
        updatedBalance = updatedBalance.addShards(
          'developer',
          finalCalculation.developerShards,
        );
      }

      if (finalCalculation.referralShards > 0) {
        updatedBalance = updatedBalance.addShards(
          'referral',
          finalCalculation.referralShards,
        );
      }

      await this.shardBalanceRepository.update(updatedBalance);
    } else {
      const newBalance = new ShardBalanceEntity(
        uuidv4(),
        walletAddress,
        seasonId,
        finalCalculation.stakingShards,
        finalCalculation.socialShards,
        finalCalculation.developerShards,
        finalCalculation.referralShards,
        finalCalculation.totalShards,
        new Date(),
        new Date(),
        new Date(),
      );

      await this.shardBalanceRepository.create(newBalance);
    }

    if (referral && referralBonus > 0) {
      referral = referral.addEarnedShards(referralBonus);
      await this.referralRepository.update(referral);
    }

    return {
      walletAddress,
      seasonId,
      date,
      stakingShards: finalCalculation.stakingShards,
      socialShards: finalCalculation.socialShards,
      developerShards: finalCalculation.developerShards,
      referralShards: finalCalculation.referralShards,
      totalShards: finalCalculation.totalShards,
      vaultBreakdown,
      fraudCheckResult,
    };
  }

  private mapHistoryToResult(
    history: ShardEarningHistoryEntity,
  ): DailyShardCalculationResult {
    return {
      walletAddress: history.walletAddress,
      seasonId: history.seasonId,
      date: history.date,
      stakingShards: history.stakingShards,
      socialShards: history.socialShards,
      developerShards: history.developerShards,
      referralShards: history.referralShards,
      totalShards: history.dailyTotal,
      vaultBreakdown: history.vaultBreakdown.map((v) => ({
        vaultAddress: v.vaultId,
        chain: v.chain,
        tokenSymbol: v.asset,
        balance: 0,
        usdValue: v.usdValue,
        shardsEarned: v.shardsEarned,
      })),
      fraudCheckResult: history.metadata?.fraudCheckResult,
    };
  }

  private async calculateSocialShards(
    walletAddress: string,
    date: Date,
  ): Promise<number> {
    this.logger.debug(
      `Social shards calculation for ${walletAddress} on ${date.toISOString()} - Kaito AI integration pending`,
    );

    return 0;
  }
}
