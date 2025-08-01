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
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';
import { StakingTransactionsResponseDto } from '../dto/staking-transactions-response.dto';
import { GetUserStakingTransactionsUseCase } from '../../application/use-cases/get-user-staking-transactions.use-case';

@ApiTags('staking')
@Controller('staking')
export class StakingTransactionsController {
  constructor(
    private readonly getUserStakingTransactionsUseCase: GetUserStakingTransactionsUseCase,
  ) {}

  @Get(':walletAddress/transactions')
  @ApiOperation({
    summary: 'Get user staking transaction history',
    description:
      'Returns historical staking transactions (deposits and withdrawals) with filtering and pagination support',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Ethereum wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'User staking transactions retrieved successfully',
    type: StakingTransactionsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet address or query parameters',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error or subgraph unavailable',
  })
  async getUserTransactions(
    @Param('walletAddress') walletAddress: string,
    @Query() query: GetTransactionsQueryDto,
  ): Promise<StakingTransactionsResponseDto> {
    let validatedAddress: string;
    try {
      if (!isAddress(walletAddress)) {
        throw new BadRequestException('Invalid wallet address format');
      }
      validatedAddress = getAddress(walletAddress);
    } catch (error) {
      throw new BadRequestException('Invalid wallet address: ' + error.message);
    }

    if (query.start_date && !this.isValidISO8601Date(query.start_date)) {
      throw new BadRequestException(
        'Invalid start_date format. Use ISO 8601 format',
      );
    }

    if (query.end_date && !this.isValidISO8601Date(query.end_date)) {
      throw new BadRequestException(
        'Invalid end_date format. Use ISO 8601 format',
      );
    }

    if (query.start_date && query.end_date) {
      const start = new Date(query.start_date);
      const end = new Date(query.end_date);
      if (start > end) {
        throw new BadRequestException('start_date cannot be after end_date');
      }
    }

    return await this.getUserStakingTransactionsUseCase.execute({
      walletAddress: validatedAddress,
      vaultId: query.vault_id,
      type: query.type,
      page: query.page || 1,
      limit: query.limit || 20,
      startDate: query.start_date,
      endDate: query.end_date,
      sortBy: query.sort_by,
      sortOrder: query.sort_order,
    });
  }

  private isValidISO8601Date(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return date.toISOString() === dateString;
    } catch {
      return false;
    }
  }
}
