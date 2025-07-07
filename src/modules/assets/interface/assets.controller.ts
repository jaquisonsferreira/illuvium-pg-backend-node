import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateAssetUseCase } from '../application/use-cases/create-asset.use-case';
import { CreateAssetDto } from '../application/dtos/create-asset.dto';
import { ThirdwebAuthGuard } from '../../auth/interface/guards/thirdweb-auth.guard';
import { CurrentUser } from '../../auth/interface/decorators/current-user.decorator';
import { UserEntity } from '../../auth/domain/entities/user.entity';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly createAssetUseCase: CreateAssetUseCase) {}

  @Post()
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiResponse({
    status: 201,
    description: 'Asset created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createAssetDto: CreateAssetDto,
    @CurrentUser() user: UserEntity,
  ) {
    // You can use the user information here if needed
    console.log(`Asset being created by user: ${user.thirdwebId}`);
    return this.createAssetUseCase.execute(createAssetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all assets (public endpoint)' })
  @ApiResponse({
    status: 200,
    description: 'Return all assets',
  })
  async findAll() {
    // This is a public endpoint - no authentication required
    return { message: 'This would return all assets' };
  }

  @Get('protected')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user-specific assets (protected endpoint)' })
  @ApiResponse({
    status: 200,
    description: 'Return user-specific assets',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProtectedAssets(@CurrentUser() user: UserEntity) {
    return {
      message: 'This would return assets for the authenticated user',
      userId: user.id,
      thirdwebId: user.thirdwebId,
    };
  }
}
