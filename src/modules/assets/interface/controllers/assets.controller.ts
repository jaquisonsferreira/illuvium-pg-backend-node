import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  SearchBlockchainAssetsUseCase,
  GetUserPortfolioUseCase,
  CreateSaleListingUseCase,
  CreateBidUseCase,
  GetAssetHistoryUseCase,
} from '../../application/use-cases';
import {
  SearchBlockchainAssetsDto,
  CreateSaleListingDto,
  CreateBidDto,
} from '../../application/dtos';
import { AssetMarketplace } from '../../domain/entities/asset-marketplace.entity';
import { BlockchainAssetRepositoryInterface } from '../../domain/repositories/blockchain-asset.repository.interface';
import { AssetMarketplaceRepositoryInterface } from '../../domain/repositories/asset-marketplace.repository.interface';
import {
  BLOCKCHAIN_ASSET_REPOSITORY,
  ASSET_MARKETPLACE_REPOSITORY,
} from '../../constants';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly searchBlockchainAssetsUseCase: SearchBlockchainAssetsUseCase,
    private readonly getUserPortfolioUseCase: GetUserPortfolioUseCase,
    private readonly createSaleListingUseCase: CreateSaleListingUseCase,
    private readonly createBidUseCase: CreateBidUseCase,
    private readonly getAssetHistoryUseCase: GetAssetHistoryUseCase,
    @Inject(BLOCKCHAIN_ASSET_REPOSITORY)
    private readonly blockchainAssetRepository: BlockchainAssetRepositoryInterface,
    @Inject(ASSET_MARKETPLACE_REPOSITORY)
    private readonly marketplaceRepository: AssetMarketplaceRepositoryInterface,
  ) {}

  private async findAssetByContractAndTokenId(
    contractAddress: string,
    tokenId: string,
  ) {
    const searchResult = await this.blockchainAssetRepository.search({
      contractAddresses: [contractAddress],
      tokenIds: [tokenId],
      limit: 1,
    });
    return searchResult.assets[0] || null;
  }

  @Get()
  @ApiOperation({ summary: 'Get assets that I own' })
  @ApiQuery({
    name: 'userAddress',
    description: 'User wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'User assets returned successfully.',
    type: Object,
  })
  async getMyAssets(@Query('userAddress') userAddress: string) {
    if (!userAddress) {
      throw new BadRequestException('userAddress query parameter is required');
    }

    return this.getUserPortfolioUseCase.execute({
      ownerAddress: userAddress,
      onlyWithBalance: true,
    });
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search for assets by wallet, collection, metadata',
    description: 'Example: Find all land that is tier 2+ with fuel sites',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully.',
    type: Object,
  })
  async searchAssets(@Query() searchDto: SearchBlockchainAssetsDto) {
    return this.searchBlockchainAssetsUseCase.execute(searchDto);
  }

  @Get(':address')
  @ApiOperation({
    summary: 'Get assets owned by address / list collection contents',
  })
  @ApiParam({
    name: 'address',
    description: 'Wallet address or contract address',
  })
  @ApiQuery({ name: 'includeTransactions', required: false, type: Boolean })
  @ApiQuery({ name: 'includeActiveListings', required: false, type: Boolean })
  @ApiQuery({ name: 'onlyWithBalance', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Address assets returned successfully.',
    type: Object,
  })
  async getAssetsByAddress(
    @Param('address') address: string,
    @Query('includeTransactions') includeTransactions?: boolean,
    @Query('includeActiveListings') includeActiveListings?: boolean,
    @Query('onlyWithBalance') onlyWithBalance?: boolean,
  ) {
    return this.getUserPortfolioUseCase.execute({
      ownerAddress: address,
      includeTransactions,
      includeActiveListings,
      onlyWithBalance,
    });
  }

  @Get(':address/:tokenId')
  @ApiOperation({ summary: 'Get specific token details' })
  @ApiParam({ name: 'address', description: 'Contract address' })
  @ApiParam({ name: 'tokenId', description: 'Token ID' })
  @ApiResponse({
    status: 200,
    description: 'Token details returned successfully.',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Token not found.' })
  async getTokenDetails(
    @Param('address') contractAddress: string,
    @Param('tokenId') tokenId: string,
  ) {
    const asset = await this.findAssetByContractAndTokenId(
      contractAddress,
      tokenId,
    );

    if (!asset) {
      throw new NotFoundException(
        `Token ${tokenId} not found in contract ${contractAddress}`,
      );
    }

    const history = await this.getAssetHistoryUseCase.execute({
      assetId: asset.id,
      includeTransactions: true,
      includeMarketplaceActivity: true,
    });

    return {
      asset,
      ...history,
    };
  }

  @Post(':address/:tokenId/bid')
  @ApiOperation({ summary: 'Put a bid on a token' })
  @ApiParam({ name: 'address', description: 'Contract address' })
  @ApiParam({ name: 'tokenId', description: 'Token ID' })
  @ApiResponse({
    status: 201,
    description: 'Bid created successfully.',
    type: AssetMarketplace,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or business rule violation.',
  })
  @ApiResponse({ status: 404, description: 'Token not found.' })
  async bidOnToken(
    @Param('address') contractAddress: string,
    @Param('tokenId') tokenId: string,
    @Body() createBidDto: CreateBidDto,
    @Query('buyerAddress') buyerAddress: string,
  ): Promise<AssetMarketplace> {
    if (!buyerAddress) {
      throw new BadRequestException('buyerAddress query parameter is required');
    }

    const asset = await this.findAssetByContractAndTokenId(
      contractAddress,
      tokenId,
    );

    if (!asset) {
      throw new NotFoundException(
        `Token ${tokenId} not found in contract ${contractAddress}`,
      );
    }

    return this.createBidUseCase.execute({
      assetId: asset.id,
      buyerAddress,
      ...createBidDto,
    });
  }

  @Put(':address/:tokenId/bid/:id')
  @ApiOperation({
    summary: 'Accept, modify, or reject a bid depending on user and context',
  })
  @ApiParam({ name: 'address', description: 'Contract address' })
  @ApiParam({ name: 'tokenId', description: 'Token ID' })
  @ApiParam({ name: 'id', description: 'Bid ID' })
  @ApiQuery({
    name: 'action',
    enum: ['accept', 'reject'],
    description: 'Action to perform',
  })
  @ApiQuery({ name: 'userAddress', description: 'User performing the action' })
  @ApiResponse({
    status: 200,
    description: 'Bid action completed successfully.',
    type: AssetMarketplace,
  })
  @ApiResponse({ status: 404, description: 'Bid not found.' })
  @ApiResponse({ status: 403, description: 'Not authorized.' })
  async manageBid(
    @Param('address') contractAddress: string,
    @Param('tokenId') tokenId: string,
    @Param('id') bidId: string,
    @Query('action') action: 'accept' | 'reject',
    @Query('userAddress') userAddress: string,
  ): Promise<AssetMarketplace> {
    if (!userAddress) {
      throw new BadRequestException('userAddress query parameter is required');
    }
    if (!action || !['accept', 'reject'].includes(action)) {
      throw new BadRequestException('action must be "accept" or "reject"');
    }

    const bid = await this.marketplaceRepository.findById(bidId);
    if (!bid) {
      throw new NotFoundException(`Bid with ID ${bidId} not found`);
    }

    const asset = await this.findAssetByContractAndTokenId(
      contractAddress,
      tokenId,
    );

    if (!asset || bid.assetId !== asset.id) {
      throw new NotFoundException(
        `Bid ${bidId} not found for token ${tokenId} in contract ${contractAddress}`,
      );
    }

    if (action === 'accept') {
      if (!bid.canBeAcceptedBy(userAddress)) {
        throw new BadRequestException('Not authorized to accept this bid');
      }
      bid.complete();
    } else {
      if (!bid.canBeModifiedBy(userAddress)) {
        throw new BadRequestException('Not authorized to reject this bid');
      }
      bid.cancel();
    }

    const updatedBid = await this.marketplaceRepository.update(bidId, bid);
    if (!updatedBid) {
      throw new NotFoundException(`Failed to ${action} bid with ID ${bidId}`);
    }

    return updatedBid;
  }

  @Post(':address/:tokenId/sell')
  @ApiOperation({ summary: 'List token for sale (can also update price)' })
  @ApiParam({ name: 'address', description: 'Contract address' })
  @ApiParam({ name: 'tokenId', description: 'Token ID' })
  @ApiResponse({
    status: 201,
    description: 'Sale listing created/updated successfully.',
    type: AssetMarketplace,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or business rule violation.',
  })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to sell this token.',
  })
  async sellToken(
    @Param('address') contractAddress: string,
    @Param('tokenId') tokenId: string,
    @Body() createSaleDto: CreateSaleListingDto,
    @Query('sellerAddress') sellerAddress: string,
  ): Promise<AssetMarketplace> {
    if (!sellerAddress) {
      throw new BadRequestException(
        'sellerAddress query parameter is required',
      );
    }

    const asset = await this.findAssetByContractAndTokenId(
      contractAddress,
      tokenId,
    );

    if (!asset) {
      throw new NotFoundException(
        `Token ${tokenId} not found in contract ${contractAddress}`,
      );
    }

    return this.createSaleListingUseCase.execute({
      assetId: asset.id,
      sellerAddress,
      ...createSaleDto,
    });
  }

  @Post(':address/:tokenId/buy')
  @ApiOperation({
    summary: 'Buy token immediately if it has a "buy now" price',
  })
  @ApiParam({ name: 'address', description: 'Contract address' })
  @ApiParam({ name: 'tokenId', description: 'Token ID' })
  @ApiQuery({ name: 'buyerAddress', description: 'Buyer wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Token purchased successfully.',
    type: AssetMarketplace,
  })
  @ApiResponse({ status: 404, description: 'Token or active sale not found.' })
  @ApiResponse({
    status: 400,
    description: 'Token not available for immediate purchase.',
  })
  async buyToken(
    @Param('address') contractAddress: string,
    @Param('tokenId') tokenId: string,
    @Query('buyerAddress') buyerAddress: string,
  ): Promise<AssetMarketplace> {
    if (!buyerAddress) {
      throw new BadRequestException('buyerAddress query parameter is required');
    }

    const asset = await this.findAssetByContractAndTokenId(
      contractAddress,
      tokenId,
    );

    if (!asset) {
      throw new NotFoundException(
        `Token ${tokenId} not found in contract ${contractAddress}`,
      );
    }

    const activeSales = await this.marketplaceRepository.findByAsset(asset.id);
    const availableSale = activeSales.find(
      (sale) =>
        sale.listingType === 'SALE' &&
        sale.status === 'ACTIVE' &&
        sale.canBeAcceptedBy(buyerAddress),
    );

    if (!availableSale) {
      throw new BadRequestException(
        `Token ${tokenId} is not available for immediate purchase`,
      );
    }

    availableSale.complete();
    const completedSale = await this.marketplaceRepository.update(
      availableSale.id,
      availableSale,
    );

    if (!completedSale) {
      throw new NotFoundException(
        `Failed to complete purchase of token ${tokenId}`,
      );
    }

    return completedSale;
  }

  @Post(':address/:tokenId/transfer')
  @ApiOperation({ summary: 'Transfer token to a different owner' })
  @ApiParam({ name: 'address', description: 'Contract address' })
  @ApiParam({ name: 'tokenId', description: 'Token ID' })
  @ApiQuery({ name: 'fromAddress', description: 'Current owner address' })
  @ApiQuery({ name: 'toAddress', description: 'Recipient address' })
  @ApiResponse({
    status: 200,
    description: 'Token transferred successfully.',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Token not found.' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to transfer this token.',
  })
  async transferToken(
    @Param('address') contractAddress: string,
    @Param('tokenId') tokenId: string,
    @Query('fromAddress') fromAddress: string,
    @Query('toAddress') toAddress: string,
  ) {
    if (!fromAddress || !toAddress) {
      throw new BadRequestException(
        'fromAddress and toAddress query parameters are required',
      );
    }

    const asset = await this.findAssetByContractAndTokenId(
      contractAddress,
      tokenId,
    );

    if (!asset) {
      throw new NotFoundException(
        `Token ${tokenId} not found in contract ${contractAddress}`,
      );
    }

    if (asset.ownerAddress !== fromAddress) {
      throw new BadRequestException(
        `Token ${tokenId} is not owned by ${fromAddress}`,
      );
    }

    const updatedAsset = await this.blockchainAssetRepository.update(asset.id, {
      ownerAddress: toAddress,
      balance: asset.balance,
    });

    if (!updatedAsset) {
      throw new NotFoundException(`Failed to transfer token ${tokenId}`);
    }

    return {
      success: true,
      message: `Token ${tokenId} transferred from ${fromAddress} to ${toAddress}`,
      asset: updatedAsset,
    };
  }
}
