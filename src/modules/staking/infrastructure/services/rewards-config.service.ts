import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { VaultType } from '../../domain/types/staking-types';

export interface RewardRate {
  rate: number;
  unit: string;
  vaultType: string;
}

export interface RewardsConfig {
  rewardRates: {
    description: string;
    rates: Record<string, RewardRate>;
    defaults: {
      single_token: number;
      lp_token: number;
    };
  };
  multipliers: {
    lockDuration: {
      description: string;
      formula: string;
      examples: {
        [key: string]: number;
      };
      min: number;
      max: number;
    };
  };
  lastUpdated: string;
  notes: string;
}

@Injectable()
export class RewardsConfigService {
  private readonly logger = new Logger(RewardsConfigService.name);
  private rewardsConfig: RewardsConfig;

  constructor() {
    this.loadRewardsConfig();
  }

  private loadRewardsConfig(): void {
    try {
      const configPath = path.join(__dirname, '../config/rewards.config.json');
      const configFile = fs.readFileSync(configPath, 'utf8');
      this.rewardsConfig = JSON.parse(configFile);
      this.logger.log('Rewards configuration loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load rewards config, using defaults', error);
      this.useDefaultConfig();
    }
  }

  private useDefaultConfig(): void {
    this.rewardsConfig = {
      rewardRates: {
        description: 'Shards reward rates per $1,000 per day',
        rates: {
          ILV: {
            rate: 80,
            unit: 'Shards / $1,000 / day',
            vaultType: 'single_token',
          },
          'ILV/ETH': {
            rate: 20,
            unit: 'Shards / $1,000 / day',
            vaultType: 'lp_token',
          },
        },
        defaults: {
          single_token: 80,
          lp_token: 20,
        },
      },
      multipliers: {
        lockDuration: {
          description: 'Multiplier based on lock duration (RevDis formula)',
          formula: '1 + lockDays / 365',
          examples: {
            '0_days': 1.0,
            '30_days': 1.08,
            '90_days': 1.25,
            '180_days': 1.49,
            '365_days': 2.0,
          },
          min: 1.0,
          max: 2.0,
        },
      },
      lastUpdated: new Date().toISOString().split('T')[0],
      notes: 'Default configuration',
    };
  }

  /**
   * Get reward rate for a specific vault
   */
  getRewardRate(vaultType: VaultType): number {
    const isLP = vaultType === VaultType.LP_TOKEN;
    return isLP
      ? this.rewardsConfig.rewardRates.defaults.lp_token
      : this.rewardsConfig.rewardRates.defaults.single_token;
  }

  /**
   * Get reward rate by asset symbol
   */
  getRewardRateBySymbol(symbol: string): number {
    const normalizedSymbol = symbol.toUpperCase().replace('-LP', '');
    const rateConfig = this.rewardsConfig.rewardRates.rates[normalizedSymbol];

    if (rateConfig) {
      return rateConfig.rate;
    }

    // Fallback to defaults based on symbol pattern
    if (symbol.includes('/') || symbol.includes('LP')) {
      return this.rewardsConfig.rewardRates.defaults.lp_token;
    }

    return this.rewardsConfig.rewardRates.defaults.single_token;
  }

  /**
   * Get formatted reward rate string
   */
  getFormattedRewardRate(vaultType: VaultType): string {
    const rate = this.getRewardRate(vaultType);
    return `${rate} Shards / $1,000 / day`;
  }

  /**
   * Calculate shards multiplier based on lock duration
   * Using RevDis formula: 1 + lockDays / 365
   * Range: 1x (0 days) to 2x (365 days)
   */
  calculateShardsMultiplier(lockDays: number): number {
    // Cap at 365 days for maximum 2x multiplier
    const cappedDays = Math.min(lockDays, 365);

    // Linear interpolation: 1 + days/365
    // 0 days = 1.0x
    // 30 days = 1.08x
    // 90 days = 1.25x
    // 180 days = 1.49x
    // 365 days = 2.0x
    return 1 + cappedDays / 365;
  }

  /**
   * Get all reward rates configuration
   */
  getAllRewardRates(): RewardsConfig['rewardRates'] {
    return this.rewardsConfig.rewardRates;
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(): void {
    this.loadRewardsConfig();
  }
}
