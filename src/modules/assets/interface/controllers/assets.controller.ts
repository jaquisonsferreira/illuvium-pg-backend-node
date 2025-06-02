import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CreateAssetUseCase } from '../../application/use-cases/create-asset.use-case';
import { CreateAssetDto } from '../../application/dtos/create-asset.dto';
import { Asset } from '../../domain/entities/asset.entity';
import { AssetRepositoryInterface } from '../../domain/repositories/asset.repository.interface';
import { ASSET_REPOSITORY } from '../../constants';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly createAssetUseCase: CreateAssetUseCase,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: AssetRepositoryInterface,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiResponse({
    status: 201,
    description: 'Asset created successfully.',
    type: Asset,
  })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  async create(@Body() createAssetDto: CreateAssetDto): Promise<Asset> {
    return this.createAssetUseCase.execute(createAssetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all assets' })
  @ApiResponse({
    status: 200,
    description: 'List of assets returned successfully.',
    type: [Asset],
  })
  async findAll(): Promise<Asset[]> {
    return this.assetRepository.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an asset by ID' })
  @ApiParam({ name: 'id', description: 'ID of the asset' })
  @ApiResponse({
    status: 200,
    description: 'Asset returned successfully.',
    type: Asset,
  })
  @ApiResponse({ status: 404, description: 'Asset not found.' })
  async findOne(@Param('id') id: string): Promise<Asset> {
    const asset = await this.assetRepository.findById(id);
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return asset;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an asset by ID' })
  @ApiParam({ name: 'id', description: 'ID of the asset' })
  @ApiResponse({
    status: 200,
    description: 'Asset updated successfully.',
    type: Asset,
  })
  @ApiResponse({ status: 404, description: 'Asset not found.' })
  async update(
    @Param('id') id: string,
    @Body() updateAssetDto: Partial<CreateAssetDto>,
  ): Promise<Asset> {
    const updatedAsset = await this.assetRepository.update(id, updateAssetDto);
    if (!updatedAsset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return updatedAsset;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an asset by ID' })
  @ApiParam({ name: 'id', description: 'ID of the asset' })
  @ApiResponse({ status: 200, description: 'Asset removed successfully.' })
  @ApiResponse({ status: 404, description: 'Asset not found.' })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const deleted = await this.assetRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return { success: true };
  }
}
