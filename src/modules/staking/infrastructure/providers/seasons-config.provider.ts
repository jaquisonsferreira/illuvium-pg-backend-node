import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SeasonsConfigService } from '../config/seasons.config';

export const SEASONS_CONFIG = 'SEASONS_CONFIG';

export const SeasonsConfigProvider: Provider = {
  provide: SEASONS_CONFIG,
  useFactory: (configService: ConfigService) => {
    return new SeasonsConfigService(configService);
  },
  inject: [ConfigService],
};
