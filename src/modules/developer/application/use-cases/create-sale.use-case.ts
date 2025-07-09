import { Injectable, Inject } from '@nestjs/common';
import {
  DEVELOPER_NFT_OPERATION_REPOSITORY,
  NftOperationType,
} from '../../constants';
import { IDeveloperApiKeyRepository } from '../../domain/repositories/developer-api-key.repository.interface';
import { IDeveloperNftOperationRepository } from '../../domain/repositories/developer-nft-operation.repository.interface';
import { DeveloperNftOperation } from '../../domain/entities/developer-nft-operation.entity';
import { DEVELOPER_API_KEY_REPOSITORY } from '../../constants';

export interface CreateSaleRequest {
  apiKeyId: string;
  contractAddress: string;
  tokenId: string;
  fromAddress: string;
  price: number;
  currency: string;
}

@Injectable()
export class CreateSaleUseCase {
  constructor(
    @Inject(DEVELOPER_API_KEY_REPOSITORY)
    private readonly apiKeyRepository: IDeveloperApiKeyRepository,
    @Inject(DEVELOPER_NFT_OPERATION_REPOSITORY)
    private readonly nftOperationRepository: IDeveloperNftOperationRepository,
  ) {}

  async execute(request: CreateSaleRequest): Promise<DeveloperNftOperation> {
    const apiKey = await this.apiKeyRepository.findById(request.apiKeyId);
    if (!apiKey) {
      throw new Error('API Key not found');
    }

    const saleMetadata = {
      contractAddress: request.contractAddress,
      fromAddress: request.fromAddress,
      price: request.price,
      currency: request.currency,
    };

    const operation = await this.nftOperationRepository.create({
      apiKeyId: request.apiKeyId,
      operationType: NftOperationType.SALE,
      toAddress: null,
      tokenId: request.tokenId,
      amount: null,
      metadata: saleMetadata,
    });

    return operation;
  }
}
