import { Injectable } from '@nestjs/common';
import { SeasonEntity } from '../entities/season.entity';
import { ReferralEntity } from '../entities/referral.entity';
import {
  REFERRAL_CONFIG,
  KAITO_CONFIG,
  DEVELOPER_REWARDS,
} from '../../constants';
import { DeveloperActionType } from '../entities/developer-contribution.entity';

@Injectable()
export class ShardCalculationDomainService {
  calculateStakingShards(
    tokenSymbol: string,
    usdValue: number,
    season: SeasonEntity,
    lockWeeks: number = 4,
  ): number {
    if (usdValue <= 0) return 0;

    const rates = season.getVaultRates();
    const rate = rates[tokenSymbol] || 100; // Default rate if not found

    // Base shards calculation
    const baseShards = (usdValue / 1000) * rate;

    // Apply lock multiplier
    const lockMultiplier = this.calculateLockMultiplier(lockWeeks);

    return baseShards * lockMultiplier;
  }

  calculateLockMultiplier(lockWeeks: number): number {
    // Linear curve: 1x at 4 weeks, 2x at 48 weeks
    // Formula: multiplier = 1 + (lockWeeks - 4) / 44
    if (lockWeeks < 4) return 1; // Minimum lock period
    if (lockWeeks > 48) return 2; // Maximum multiplier

    return 1 + (lockWeeks - 4) / 44;
  }

  calculateSocialShards(yapPoints: number, season: SeasonEntity): number {
    if (yapPoints <= 0) return 0;

    const conversionRate =
      season.getSocialConversionRate() || KAITO_CONFIG.YAP_TO_SHARD_RATE;
    return yapPoints / conversionRate;
  }

  calculateDeveloperShards(
    actionType: DeveloperActionType,
    customAmount?: number,
  ): number {
    if (customAmount !== undefined && customAmount >= 0) {
      return customAmount;
    }

    const rewards: Record<DeveloperActionType, number> = {
      [DeveloperActionType.SMART_CONTRACT_DEPLOY]: 100,
      [DeveloperActionType.VERIFIED_CONTRACT]: 200,
      [DeveloperActionType.GITHUB_CONTRIBUTION]: 50,
      [DeveloperActionType.BUG_REPORT]: 150,
      [DeveloperActionType.DOCUMENTATION]: 75,
      [DeveloperActionType.TOOL_DEVELOPMENT]: 300,
      [DeveloperActionType.COMMUNITY_SUPPORT]: 25,
      [DeveloperActionType.DEPLOY_CONTRACT]: DEVELOPER_REWARDS.DEPLOY_CONTRACT,
      [DeveloperActionType.DEPLOY_DAPP]: DEVELOPER_REWARDS.DEPLOY_DAPP,
      [DeveloperActionType.CONTRIBUTE_CODE]: DEVELOPER_REWARDS.CONTRIBUTE_CODE,
      [DeveloperActionType.FIX_BUG]: DEVELOPER_REWARDS.FIX_BUG,
      [DeveloperActionType.COMPLETE_BOUNTY]: DEVELOPER_REWARDS.COMPLETE_BOUNTY,
      [DeveloperActionType.CREATE_DOCUMENTATION]: 50,
      [DeveloperActionType.OTHER]: 0,
    };

    return rewards[actionType] || 0;
  }

  calculateReferralBonus(
    refereeShards: number,
    referral: ReferralEntity,
  ): { referrerBonus: number; refereeMultiplier: number } {
    if (!referral.isActive()) {
      return { referrerBonus: 0, refereeMultiplier: 1 };
    }

    const referrerBonusAmount =
      refereeShards * REFERRAL_CONFIG.REFERRER_BONUS_RATE;
    const referrerBonus = Math.min(
      referrerBonusAmount,
      REFERRAL_CONFIG.MAX_REFERRER_BONUS_PER_REFERRAL,
    );

    const refereeMultiplier = referral.isWithinBonusPeriod()
      ? REFERRAL_CONFIG.REFEREE_MULTIPLIER
      : 1;

    return { referrerBonus, refereeMultiplier };
  }

  applyRefereeMultiplier(baseShards: number, multiplier: number): number {
    return baseShards * multiplier;
  }

  calculateTotalDailyShards(params: {
    stakingShards: number;
    socialShards: number;
    developerShards: number;
    referralBonus: number;
    refereeMultiplier?: number;
  }): {
    stakingShards: number;
    socialShards: number;
    developerShards: number;
    referralShards: number;
    totalShards: number;
  } {
    const multiplier = params.refereeMultiplier || 1;

    // Apply multiplier to all categories except referral bonus
    const stakingShards = this.applyRefereeMultiplier(
      params.stakingShards,
      multiplier,
    );
    const socialShards = this.applyRefereeMultiplier(
      params.socialShards,
      multiplier,
    );
    const developerShards = this.applyRefereeMultiplier(
      params.developerShards,
      multiplier,
    );
    const referralShards = params.referralBonus; // Referral bonus is not multiplied

    const totalShards =
      stakingShards + socialShards + developerShards + referralShards;

    return {
      stakingShards,
      socialShards,
      developerShards,
      referralShards,
      totalShards,
    };
  }

  validateShardAmount(amount: number, category: string): boolean {
    if (amount < 0) {
      return false;
    }

    // Check for suspiciously high amounts (could be expanded with more rules)
    const maxReasonableAmounts: Record<string, number> = {
      staking: 100000, // $400k at 250 shards/$1k
      social: 10000,
      developer: 5000,
      referral: 500, // Already capped by system
    };

    const maxAmount = maxReasonableAmounts[category];
    if (maxAmount && amount > maxAmount) {
      return false;
    }

    return true;
  }

  roundShards(amount: number): number {
    // Round to 2 decimal places
    return Math.round(amount * 100) / 100;
  }
}
