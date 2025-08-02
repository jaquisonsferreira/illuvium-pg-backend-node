import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStakingSubgraphRepository } from '../../domain/repositories/staking-subgraph.repository.interface';
import { StakingSubgraphService } from './staking-subgraph.service';
import { AlchemyStakingService } from './alchemy-staking.service';

export type DataProvider = 'subgraph' | 'alchemy';

@Injectable()
export class StakingDataProviderFactory {
  private readonly logger = new Logger(StakingDataProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly subgraphService: StakingSubgraphService,
    private readonly alchemyService: AlchemyStakingService,
  ) {}

  createProvider(): IStakingSubgraphRepository {
    const provider = this.configService.get<DataProvider>(
      'DATA_PROVIDER',
      'subgraph',
    );

    this.logger.log(`Using data provider: ${provider}`);

    switch (provider) {
      case 'alchemy':
        return this.alchemyService;
      case 'subgraph':
      default:
        return this.subgraphService;
    }
  }

  async getProviderHealth(): Promise<{
    provider: DataProvider;
    isHealthy: boolean;
    details: any;
  }> {
    const provider = this.configService.get<DataProvider>(
      'DATA_PROVIDER',
      'subgraph',
    );
    const service = this.createProvider();

    try {
      const health = await service.healthCheck('BASE' as any);
      return {
        provider,
        isHealthy: health.isHealthy,
        details: health,
      };
    } catch (error) {
      this.logger.error(`Health check failed for provider ${provider}:`, error);
      return {
        provider,
        isHealthy: false,
        details: { error: error.message },
      };
    }
  }

  async switchProvider(newProvider: DataProvider): Promise<void> {
    this.logger.log(`Switching data provider to: ${newProvider}`);
    process.env.DATA_PROVIDER = newProvider;
  }
}
