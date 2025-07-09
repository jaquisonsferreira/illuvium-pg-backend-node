import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { MintNftDto } from '../dtos/mint-nft.dto';
import { BurnNftDto } from '../dtos/burn-nft.dto';
import { TransferNftDto } from '../dtos/transfer-nft.dto';
import { UpdateNftMetadataDto } from '../dtos/update-nft-metadata.dto';
import { CreateSaleDto } from '../dtos/create-sale.dto';
import { MintNftUseCase } from '../../application/use-cases/mint-nft.use-case';
import { BurnNftUseCase } from '../../application/use-cases/burn-nft.use-case';
import { TransferNftUseCase } from '../../application/use-cases/transfer-nft.use-case';
import { UpdateNftMetadataUseCase } from '../../application/use-cases/update-nft-metadata.use-case';
import { CreateSaleUseCase } from '../../application/use-cases/create-sale.use-case';

@ApiTags('Developer NFT Operations')
@Controller('developer/nft')
@UseGuards(ApiKeyGuard)
export class DeveloperNftController {
  constructor(
    private readonly mintNftUseCase: MintNftUseCase,
    private readonly burnNftUseCase: BurnNftUseCase,
    private readonly transferNftUseCase: TransferNftUseCase,
    private readonly updateNftMetadataUseCase: UpdateNftMetadataUseCase,
    private readonly createSaleUseCase: CreateSaleUseCase,
  ) {}

  @Post('mint')
  @ApiOperation({ summary: 'Mint a new NFT' })
  @ApiResponse({ status: 201, description: 'NFT minting operation created' })
  async mintNft(@Body() mintNftDto: MintNftDto, @Request() req: any) {
    const apiKeyId = req.apiKeyId;

    const operation = await this.mintNftUseCase.execute({
      apiKeyId,
      ...mintNftDto,
    });

    return {
      operationId: operation.id,
      type: operation.operationType,
      status: operation.status,
      toAddress: operation.toAddress,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
    };
  }

  @Post('burn')
  @ApiOperation({ summary: 'Burn an NFT' })
  @ApiResponse({ status: 201, description: 'NFT burn operation created' })
  async burnNft(@Body() burnNftDto: BurnNftDto, @Request() req: any) {
    const apiKeyId = req.apiKeyId;

    const operation = await this.burnNftUseCase.execute({
      apiKeyId,
      ...burnNftDto,
    });

    return {
      operationId: operation.id,
      type: operation.operationType,
      status: operation.status,
      tokenId: operation.tokenId,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
    };
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer an NFT' })
  @ApiResponse({ status: 201, description: 'NFT transfer operation created' })
  async transferNft(
    @Body() transferNftDto: TransferNftDto,
    @Request() req: any,
  ) {
    const apiKeyId = req.apiKeyId;

    const operation = await this.transferNftUseCase.execute({
      apiKeyId,
      ...transferNftDto,
    });

    return {
      operationId: operation.id,
      type: operation.operationType,
      status: operation.status,
      toAddress: operation.toAddress,
      tokenId: operation.tokenId,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
    };
  }

  @Post('update-metadata')
  @ApiOperation({ summary: 'Update NFT metadata' })
  @ApiResponse({
    status: 201,
    description: 'NFT metadata update operation created',
  })
  async updateMetadata(
    @Body() updateMetadataDto: UpdateNftMetadataDto,
    @Request() req: any,
  ) {
    const apiKeyId = req.apiKeyId;

    const operation = await this.updateNftMetadataUseCase.execute({
      apiKeyId,
      ...updateMetadataDto,
    });

    return {
      operationId: operation.id,
      type: operation.operationType,
      status: operation.status,
      tokenId: operation.tokenId,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
    };
  }

  @Post('create-sale')
  @ApiOperation({ summary: 'Create a sale listing for an NFT' })
  @ApiResponse({ status: 201, description: 'Sale operation created' })
  async createSale(@Body() createSaleDto: CreateSaleDto, @Request() req: any) {
    const apiKeyId = req.apiKeyId;

    const operation = await this.createSaleUseCase.execute({
      apiKeyId,
      contractAddress: createSaleDto.contractAddress,
      tokenId: createSaleDto.tokenId,
      fromAddress: createSaleDto.fromAddress,
      price: parseFloat(createSaleDto.price),
      currency: createSaleDto.currency,
    });

    return {
      operationId: operation.id,
      type: operation.operationType,
      status: operation.status,
      tokenId: operation.tokenId,
      metadata: operation.metadata,
      createdAt: operation.createdAt,
    };
  }
}
