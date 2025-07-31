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
import { GetPositionsQueryDto } from '../dto/get-positions-query.dto';
import { StakingPositionsResponseDto } from '../dto/staking-positions-response.dto';
import { GetUserStakingPositionsUseCase } from '../../application/use-cases/get-user-staking-positions.use-case';

@ApiTags('staking')
@Controller('api/staking')
export class StakingPositionsController {
  constructor(
    private readonly getUserStakingPositionsUseCase: GetUserStakingPositionsUseCase,
  ) {}

  @Get(':walletAddress/positions')
  @ApiOperation({
    summary: 'Get user staking positions',
    description:
      'Returns current staking positions across all active vaults including LP token support',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Ethereum wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'User staking positions retrieved successfully',
    type: StakingPositionsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet address or query parameters',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error or subgraph unavailable',
  })
  async getUserPositions(
    @Param('walletAddress') walletAddress: string,
    @Query() query: GetPositionsQueryDto,
  ): Promise<StakingPositionsResponseDto> {
    // Validate wallet address format
    if (!this.isValidEthereumAddress(walletAddress)) {
      throw new BadRequestException('Invalid wallet address format');
    }

    // Validate query parameters
    if (query.limit !== undefined && query.limit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }

    if (query.page !== undefined && query.page < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }

    return await this.getUserStakingPositionsUseCase.execute({
      walletAddress,
      vaultId: query.vault_id,
      page: query.page || 1,
      limit: query.limit || 10,
      search: query.search,
    });
  }

  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}
