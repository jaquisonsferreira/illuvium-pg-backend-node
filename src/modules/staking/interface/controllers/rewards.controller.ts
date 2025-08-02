import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  RewardsConfigService,
  RewardsConfig,
} from '../../infrastructure/services/rewards-config.service';

@ApiTags('staking/rewards')
@Controller('staking/rewards')
export class RewardsController {
  constructor(private readonly rewardsConfigService: RewardsConfigService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Get current rewards configuration',
    description: 'Returns the current rewards rates and multiplier settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Rewards configuration retrieved successfully',
  })
  getRewardsConfig(): RewardsConfig['rewardRates'] {
    return this.rewardsConfigService.getAllRewardRates();
  }
}
