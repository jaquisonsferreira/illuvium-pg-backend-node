import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  HttpException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import {
  SeasonDto,
  CreateSeasonDto,
  UpdateSeasonDto,
  SeasonsListResponseDto,
  ErrorResponseDto,
  ApiError,
} from '../dto';
import { ManageSeasonUseCase } from '../../application/use-cases/manage-season.use-case';

@ApiTags('seasons')
@Controller('seasons')
export class SeasonsController {
  constructor(private readonly manageSeasonUseCase: ManageSeasonUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Get all seasons',
    description: 'Returns list of all seasons with current season marked',
  })
  @ApiResponse({
    status: 200,
    description: 'Seasons retrieved successfully',
    type: SeasonsListResponseDto,
  })
  async getSeasons(): Promise<SeasonsListResponseDto> {
    try {
      const seasons = await this.manageSeasonUseCase.getUpcomingSeasons();
      const currentSeason =
        await this.manageSeasonUseCase.getCurrentSeason('base');

      return {
        data: seasons.map((season) => this.mapSeasonToDto(season)),
        current_season_id: currentSeason?.id || 1,
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        {
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to retrieve seasons',
          path: '/api/seasons',
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  }

  @Get(':seasonId')
  @ApiOperation({
    summary: 'Get season by ID',
    description: 'Returns detailed information about a specific season',
  })
  @ApiParam({
    name: 'seasonId',
    description: 'Season ID',
    type: 'number',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Season retrieved successfully',
    type: SeasonDto,
  })
  @ApiNotFoundResponse({
    description: 'Season not found',
    type: ErrorResponseDto,
  })
  async getSeason(
    @Param('seasonId', ParseIntPipe) seasonId: number,
  ): Promise<SeasonDto> {
    try {
      const season = await this.manageSeasonUseCase.getSeasonStats(seasonId);

      if (!season) {
        throw ApiError.seasonNotFound(seasonId);
      }

      return this.mapSeasonToDto(season);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            path: `/api/seasons/${seasonId}`,
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }
      throw error;
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new season',
    description: 'Creates a new season with specified configuration',
  })
  @ApiBody({ type: CreateSeasonDto })
  @ApiCreatedResponse({
    description: 'Season created successfully',
    type: SeasonDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid season data',
    type: ErrorResponseDto,
  })
  async createSeason(
    @Body() createSeasonDto: CreateSeasonDto,
  ): Promise<SeasonDto> {
    try {
      const season = await this.manageSeasonUseCase.createSeason({
        name: createSeasonDto.name,
        chain: createSeasonDto.primary_chain,
        startDate: new Date(createSeasonDto.start_date),
        endDate: new Date(createSeasonDto.end_date),
        config: {
          vaultRates: createSeasonDto.vault_rates,
          socialConversionRate: createSeasonDto.social_conversion_rate,
          referralConfig: createSeasonDto.referral_config,
        },
      });

      return this.mapSeasonToDto(season);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: 400,
          error: 'INVALID_SEASON_DATA',
          message: error.message || 'Failed to create season',
          path: '/api/seasons',
          timestamp: new Date().toISOString(),
        },
        400,
      );
    }
  }

  @Put(':seasonId')
  @ApiOperation({
    summary: 'Update a season',
    description: 'Updates an existing season configuration',
  })
  @ApiParam({
    name: 'seasonId',
    description: 'Season ID',
    type: 'number',
    example: 1,
  })
  @ApiBody({ type: UpdateSeasonDto })
  @ApiResponse({
    status: 200,
    description: 'Season updated successfully',
    type: SeasonDto,
  })
  @ApiNotFoundResponse({
    description: 'Season not found',
    type: ErrorResponseDto,
  })
  async updateSeason(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Body() updateSeasonDto: UpdateSeasonDto,
  ): Promise<SeasonDto> {
    try {
      const season = await this.manageSeasonUseCase.updateSeason({
        id: seasonId,
        name: updateSeasonDto.name,
        endDate: updateSeasonDto.end_date
          ? new Date(updateSeasonDto.end_date)
          : undefined,
        config: updateSeasonDto.vault_rates
          ? {
              vaultRates: updateSeasonDto.vault_rates,
              socialConversionRate: 100,
            }
          : undefined,
      });

      if (!season) {
        throw ApiError.seasonNotFound(seasonId);
      }

      return this.mapSeasonToDto(season);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new HttpException(
          {
            statusCode: error.statusCode,
            error: error.errorCode,
            message: error.message,
            path: `/api/seasons/${seasonId}`,
            timestamp: new Date().toISOString(),
          },
          error.statusCode,
        );
      }
      throw error;
    }
  }

  private mapSeasonToDto(season: any): SeasonDto {
    return {
      season_id: season.id,
      name: season.name,
      description: season.description || '',
      start_date: season.startDate
        ? season.startDate.toISOString()
        : new Date().toISOString(),
      end_date: season.endDate ? season.endDate.toISOString() : null,
      primary_chain: season.chain || 'base',
      is_active: season.status === 'active',
      vault_rates: season.config?.vaultRates || {},
      total_shards_distributed: season.totalShardsIssued || 0,
      active_participants: season.totalParticipants || 0,
      social_conversion_rate: season.config?.socialConversionRate || 100,
      referral_config: season.config?.referralConfig || {},
    };
  }
}
