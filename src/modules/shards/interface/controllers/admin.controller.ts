import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ShardProcessingScheduler } from '../schedulers/shard-processing.scheduler';
import { DatabaseSeedService } from '../../infrastructure/services/database-seed.service';

@ApiTags('admin')
@Controller('admin/shards')
export class AdminShardsController {
  constructor(
    private readonly shardProcessingScheduler: ShardProcessingScheduler,
    private readonly databaseSeedService: DatabaseSeedService,
  ) {}

  @Post('trigger-processing')
  @ApiOperation({
    summary: 'Trigger manual shard processing',
    description:
      'Manually triggers the shard processing job for immediate execution',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['daily', 'vault', 'social', 'developer'],
          description: 'Type of processing to trigger',
        },
      },
      required: ['type'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Processing triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid processing type',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to trigger processing',
  })
  async triggerProcessing(
    @Body() body: { type: string },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const validTypes = ['daily', 'vault', 'social', 'developer'];

      if (!validTypes.includes(body.type)) {
        throw new HttpException(
          `Invalid processing type. Must be one of: ${validTypes.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.shardProcessingScheduler.triggerManualProcessing(body.type);

      return {
        success: true,
        message: `${body.type} processing triggered successfully`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to trigger processing: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('seed-database')
  @ApiOperation({
    summary: 'Manually seed database',
    description: 'Forces database seeding with test data',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: 'Force reseed even if data exists',
          default: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Database seeded successfully',
  })
  async seedDatabase(
    @Body() body: { force?: boolean },
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.databaseSeedService.reseedDatabase(body?.force !== false);

      return {
        success: true,
        message: 'Database seeded successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to seed database: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
