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
import { getAddress, isAddress } from 'ethers';
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
    let validatedAddress: string;
    try {
      if (!isAddress(walletAddress)) {
        throw new BadRequestException('Invalid wallet address format');
      }
      validatedAddress = getAddress(walletAddress);
    } catch (error) {
      throw new BadRequestException('Invalid wallet address: ' + error.message);
    }

    if (query.limit !== undefined && query.limit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }

    if (query.page !== undefined && query.page < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }

    return await this.getUserStakingPositionsUseCase.execute({
      walletAddress: validatedAddress,
      vaultId: query.vault_id,
      page: query.page || 1,
      limit: query.limit || 10,
      search: query.search,
    });
  }
}
