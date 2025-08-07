import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ISeasonRepository } from '../../domain/repositories/season.repository.interface';
import { IShardBalanceRepository } from '../../domain/repositories/shard-balance.repository.interface';
import { SeasonEntity } from '../../domain/entities/season.entity';
import { ShardBalanceEntity } from '../../domain/entities/shard-balance.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @Inject('ISeasonRepository')
    private readonly seasonRepository: ISeasonRepository,
    @Inject('IShardBalanceRepository')
    private readonly shardBalanceRepository: IShardBalanceRepository,
  ) {}

  async onModuleInit() {
    await this.seedDatabase();
  }

  private async seedDatabase() {
    try {
      this.logger.log('Checking database seed status...');

      await this.seedSeasons();
      await this.seedShardBalances();

      this.logger.log('Database seed completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed database:', error);
    }
  }

  private async seedSeasons() {
    try {
      const existingSeasons = await this.seasonRepository.findAll();

      if (existingSeasons.length === 0) {
        this.logger.log('No seasons found, creating default season...');

        const season = new SeasonEntity(
          1,
          'Season 1',
          'base',
          new Date('2025-01-01'),
          new Date('2025-12-31'),
          'active',
          {
            vaultRates: {
              ILV: 100,
              sILV: 150,
              sILV2: 200,
              ILV_ETH_LP: 300,
            },
            socialConversionRate: 100,
            vaultLocked: false,
            withdrawalEnabled: true,
            redeemPeriodDays: 30,
          },
          0,
          0,
          new Date(),
          new Date(),
        );

        await this.seasonRepository.create(season);
        this.logger.log('Season 1 created successfully');
      } else {
        this.logger.log(`Found ${existingSeasons.length} existing seasons`);
      }
    } catch (error) {
      this.logger.error('Failed to seed seasons:', error);
    }
  }

  private async seedShardBalances() {
    try {
      this.logger.log('Starting shard balance seed...');

      const activeSeason = await this.seasonRepository.findActive();
      if (!activeSeason) {
        this.logger.warn('No active season found, skipping shard balance seed');
        return;
      }

      this.logger.log(
        `Active season found: ${activeSeason.name} (ID: ${activeSeason.id})`,
      );

      const totalParticipants =
        await this.shardBalanceRepository.getTotalParticipantsBySeason(
          activeSeason.id,
        );

      this.logger.log(`Total participants found: ${totalParticipants}`);
      this.logger.log(`Type of totalParticipants: ${typeof totalParticipants}`);
      this.logger.log(`totalParticipants === 0: ${totalParticipants === 0}`);
      this.logger.log(`totalParticipants == 0: ${totalParticipants == 0}`);

      if (totalParticipants == 0) {
        this.logger.log('No shard balances found, creating test data...');

        const testWallets = [
          {
            address: '0x1234567890abcdef1234567890abcdef12345678',
            staking: 1000.5,
            social: 500.25,
            developer: 300.75,
            referral: 200,
          },
          {
            address: '0xabcdef1234567890abcdef1234567890abcdef12',
            staking: 950,
            social: 450,
            developer: 350,
            referral: 150,
          },
          {
            address: '0x9876543210fedcba9876543210fedcba98765432',
            staking: 900,
            social: 400,
            developer: 400,
            referral: 100,
          },
          {
            address: '0xfedcba9876543210fedcba9876543210fedcba98',
            staking: 850,
            social: 350,
            developer: 450,
            referral: 50,
          },
          {
            address: '0x1111111111111111111111111111111111111111',
            staking: 800,
            social: 300,
            developer: 200,
            referral: 300,
          },
          {
            address: '0x2222222222222222222222222222222222222222',
            staking: 750,
            social: 250,
            developer: 250,
            referral: 250,
          },
          {
            address: '0x3333333333333333333333333333333333333333',
            staking: 700,
            social: 200,
            developer: 300,
            referral: 200,
          },
          {
            address: '0x4444444444444444444444444444444444444444',
            staking: 650,
            social: 150,
            developer: 350,
            referral: 150,
          },
          {
            address: '0x5555555555555555555555555555555555555555',
            staking: 600,
            social: 100,
            developer: 400,
            referral: 100,
          },
          {
            address: '0x6666666666666666666666666666666666666666',
            staking: 550,
            social: 50,
            developer: 450,
            referral: 50,
          },
        ];

        for (const wallet of testWallets) {
          try {
            const totalShards =
              wallet.staking +
              wallet.social +
              wallet.developer +
              wallet.referral;

            const shardBalance = new ShardBalanceEntity(
              uuidv4(),
              wallet.address,
              activeSeason.id,
              wallet.staking,
              wallet.social,
              wallet.developer,
              wallet.referral,
              totalShards,
              new Date(),
              new Date(),
              new Date(),
            );

            await this.shardBalanceRepository.create(shardBalance);
            this.logger.debug(
              `Created shard balance for wallet: ${wallet.address}`,
            );
          } catch (walletError) {
            this.logger.error(
              `Failed to create shard balance for wallet ${wallet.address}:`,
              walletError,
            );
          }
        }

        this.logger.log(`Created ${testWallets.length} test shard balances`);
      } else {
        this.logger.log(
          `Skipping shard balance seed - found ${totalParticipants} existing participants`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to seed shard balances:', error);
    }
  }

  async reseedDatabase(force: boolean = false) {
    if (force) {
      this.logger.warn('Force reseeding database...');
      await this.seedDatabase();
    } else {
      this.logger.log('Reseed called without force flag, skipping');
    }
  }
}
