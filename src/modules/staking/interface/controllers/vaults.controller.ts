import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { GetVaultsQueryDto } from '../dto/get-vaults-query.dto';
import { VaultListResponseDto } from '../dto/vault-list-response.dto';
import { GetVaultsUseCase } from '../../application/use-cases/get-vaults.use-case';
import { GetVaultDetailsUseCase } from '../../application/use-cases/get-vault-details.use-case';
import { GetStakingStatsUseCase } from '../../application/use-cases/get-staking-stats.use-case';
import { isAddress, getAddress } from 'ethers';

@ApiTags('staking')
@Controller('api/staking')
export class VaultsController {
  constructor(
    private readonly getVaultsUseCase: GetVaultsUseCase,
    private readonly getVaultDetailsUseCase: GetVaultDetailsUseCase,
    private readonly getStakingStatsUseCase: GetStakingStatsUseCase,
  ) {}

  @Get('vaults')
  @ApiOperation({
    summary: 'List all staking vaults',
    description:
      'Returns comprehensive list of all available vaults with metadata, filtering, sorting, and pagination support',
  })
  @ApiResponse({
    status: 200,
    description: 'Vaults retrieved successfully',
    type: VaultListResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error or subgraph unavailable',
  })
  async getVaults(
    @Query() query: GetVaultsQueryDto,
  ): Promise<VaultListResponseDto> {
    return await this.getVaultsUseCase.execute(query);
  }

  @Get('vaults/:vaultId')
  @ApiOperation({
    summary: 'Get detailed vault information',
    description:
      'Provides detailed vault information with time-series analytics and optional user position data',
  })
  @ApiParam({
    name: 'vaultId',
    description: 'Vault identifier',
    example: 'ILV_vault_base',
  })
  @ApiResponse({
    status: 200,
    description: 'Vault details retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid vault ID or wallet address',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error or subgraph unavailable',
  })
  async getVaultDetails(
    @Param('vaultId') vaultId: string,
    @Query('walletAddress') walletAddress?: string,
    @Query('timeframe') timeframe?: string,
  ) {
    if (walletAddress) {
      try {
        if (!isAddress(walletAddress)) {
          throw new BadRequestException('Invalid wallet address format');
        }
        walletAddress = getAddress(walletAddress);
      } catch (error) {
        throw new BadRequestException('Invalid wallet address: ' + error.message);
      }
    }

    const validTimeframes = ['24h', '7d', '30d', 'all'];
    if (timeframe && !validTimeframes.includes(timeframe)) {
      throw new BadRequestException(
        `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`,
      );
    }

    return await this.getVaultDetailsUseCase.execute({
      vaultId,
      walletAddress,
      timeframe: timeframe || '30d',
    });
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get ecosystem staking statistics',
    description:
      'Aggregate ecosystem statistics across all vaults including TVL, volume, and active vault count',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error or subgraph unavailable',
  })
  async getStakingStats(@Query('timeframe') timeframe?: string) {
    const validTimeframes = ['24h', '7d'];
    if (timeframe && !validTimeframes.includes(timeframe)) {
      throw new BadRequestException(
        `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`,
      );
    }

    return await this.getStakingStatsUseCase.execute({
      timeframe: timeframe || '24h',
    });
  }
}