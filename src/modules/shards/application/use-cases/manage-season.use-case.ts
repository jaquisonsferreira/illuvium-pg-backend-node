import { Injectable, Logger } from '@nestjs/common';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import { SeasonEntity } from '../../domain/entities/season.entity';

interface CreateSeasonDto {
  name: string;
  chain: string;
  startDate: Date;
  endDate?: Date;
  config: {
    vaultRates: Record<string, number>;
    socialConversionRate?: number;
    developerRewards?: Record<string, number>;
    referralConfig?: {
      activationThreshold?: number;
      referrerBonusRate?: number;
      refereeMultiplier?: number;
      bonusDurationDays?: number;
      maxReferralsPerWallet?: number;
    };
  };
}

interface UpdateSeasonDto {
  id: number;
  name?: string;
  endDate?: Date;
  status?: 'upcoming' | 'active' | 'completed' | 'cancelled';
  config?: Partial<CreateSeasonDto['config']>;
}

interface SeasonStats {
  id: number;
  name: string;
  chain: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  totalParticipants: number;
  totalShardsIssued: number;
  daysRemaining: number | null;
  progress: number; // Percentage
}

@Injectable()
export class ManageSeasonUseCase {
  private readonly logger = new Logger(ManageSeasonUseCase.name);

  constructor(private readonly seasonRepository: ISeasonRepository) {}

  async createSeason(dto: CreateSeasonDto): Promise<SeasonEntity> {
    const { name, chain, startDate, endDate, config } = dto;

    if (endDate && endDate <= startDate) {
      throw new Error('End date must be after start date');
    }

    const activeSeasons = await this.seasonRepository.findActiveByChain(chain);
    for (const season of activeSeasons) {
      if (
        this.datesOverlap(startDate, endDate, season.startDate, season.endDate)
      ) {
        throw new Error(
          `Season dates overlap with existing season "${season.name}" on ${chain}`,
        );
      }
    }

    const now = new Date();
    let status: 'upcoming' | 'active' | 'completed' = 'upcoming';

    if (startDate <= now) {
      if (!endDate || endDate > now) {
        status = 'active';
      } else {
        status = 'completed';
      }
    }

    const seasonConfig = {
      vaultRates: config.vaultRates,
      socialConversionRate: config.socialConversionRate || 100,
      vaultLocked: true,
      withdrawalEnabled: false,
      redeemPeriodDays: 14,
    };

    const season = new SeasonEntity(
      0,
      name,
      chain,
      startDate,
      endDate || null,
      status,
      seasonConfig,
      0,
      0,
      new Date(),
      new Date(),
    );

    const created = await this.seasonRepository.create(season);
    this.logger.log(
      `Created season "${name}" on ${chain} with status ${status}`,
    );

    return created;
  }

  async updateSeason(dto: UpdateSeasonDto): Promise<SeasonEntity> {
    const { id, name, endDate, status, config } = dto;

    const season = await this.seasonRepository.findById(id);
    if (!season) {
      throw new Error(`Season ${id} not found`);
    }

    if (endDate !== undefined && endDate && endDate <= season.startDate) {
      throw new Error('End date must be after start date');
    }

    if (status !== undefined) {
      this.validateStatusTransition(season.status, status);
    }

    const updateParams: {
      name?: string;
      endDate?: Date | null;
      status?: 'active' | 'completed' | 'upcoming';
      config?: any;
    } = {};

    if (name !== undefined) {
      updateParams.name = name;
    }

    if (endDate !== undefined) {
      updateParams.endDate = endDate;
    }

    if (status !== undefined) {
      updateParams.status = status as 'active' | 'completed' | 'upcoming';
    }

    if (config !== undefined) {
      updateParams.config = { ...season.config, ...config };
    }

    const updatedSeason = season.update(updateParams);
    const updated = await this.seasonRepository.update(updatedSeason);
    this.logger.log(`Updated season ${id}: ${JSON.stringify(dto)}`);

    return updated;
  }

  async activateSeason(seasonId: number): Promise<SeasonEntity> {
    const season = await this.seasonRepository.findById(seasonId);
    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    if (season.status !== 'upcoming') {
      throw new Error(
        `Can only activate upcoming seasons. Current status: ${season.status}`,
      );
    }

    const now = new Date();
    if (season.startDate > now) {
      throw new Error('Cannot activate season before start date');
    }

    return this.updateSeason({ id: seasonId, status: 'active' });
  }

  async completeSeason(seasonId: number): Promise<SeasonEntity> {
    const season = await this.seasonRepository.findById(seasonId);
    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    if (season.status !== 'active') {
      throw new Error(
        `Can only complete active seasons. Current status: ${season.status}`,
      );
    }

    const updates: UpdateSeasonDto = {
      id: seasonId,
      status: 'completed',
    };

    if (!season.endDate) {
      updates.endDate = new Date();
    }

    return this.updateSeason(updates);
  }

  async getSeasonStats(seasonId: number): Promise<SeasonStats> {
    const season = await this.seasonRepository.findById(seasonId);
    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    const now = new Date();
    let daysRemaining: number | null = null;
    let progress = 0;

    if (season.endDate) {
      if (season.endDate > now) {
        daysRemaining = Math.ceil(
          (season.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      const totalDuration =
        season.endDate.getTime() - season.startDate.getTime();
      const elapsed = Math.min(
        now.getTime() - season.startDate.getTime(),
        totalDuration,
      );
      progress = (elapsed / totalDuration) * 100;
    } else if (season.status === 'active') {
      const daysSinceStart = Math.floor(
        (now.getTime() - season.startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      progress = Math.min(daysSinceStart, 100);
    }

    return {
      id: season.id,
      name: season.name,
      chain: season.chain,
      status: season.status,
      startDate: season.startDate,
      endDate: season.endDate,
      totalParticipants: season.totalParticipants,
      totalShardsIssued: season.totalShardsIssued,
      daysRemaining,
      progress: Math.round(progress * 100) / 100,
    };
  }

  async getCurrentSeason(chain: string): Promise<SeasonEntity | null> {
    const activeSeasons = await this.seasonRepository.findActiveByChain(chain);

    return activeSeasons.length > 0 ? activeSeasons[0] : null;
  }

  async getUpcomingSeasons(chain?: string): Promise<SeasonEntity[]> {
    const allSeasons = chain
      ? await this.seasonRepository.findByChain(chain)
      : await this.seasonRepository.findAll();

    return allSeasons.filter((s) => s.status === 'upcoming');
  }

  async checkAndUpdateSeasonStatuses(): Promise<number> {
    const now = new Date();
    let updatedCount = 0;

    const upcomingSeasons = await this.getUpcomingSeasons();
    for (const season of upcomingSeasons) {
      if (season.startDate <= now) {
        try {
          await this.activateSeason(season.id);
          updatedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to auto-activate season ${season.id}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    const activeSeasons = await this.seasonRepository.findByStatus('active');
    for (const season of activeSeasons) {
      if (season.endDate && season.endDate <= now) {
        try {
          await this.completeSeason(season.id);
          updatedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to auto-complete season ${season.id}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    if (updatedCount > 0) {
      this.logger.log(`Updated ${updatedCount} season statuses`);
    }

    return updatedCount;
  }

  private datesOverlap(
    start1: Date,
    end1: Date | null | undefined,
    start2: Date,
    end2: Date | null,
  ): boolean {
    const e1 = end1 || new Date('2100-01-01');
    const e2 = end2 || new Date('2100-01-01');

    return start1 < e2 && start2 < e1;
  }

  private validateStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): void {
    const validTransitions: Record<string, string[]> = {
      upcoming: ['active', 'cancelled'],
      active: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
