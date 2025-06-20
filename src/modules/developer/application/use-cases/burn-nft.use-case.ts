import { Injectable, Inject } from '@nestjs/common';
import {
  DEVELOPER_NFT_OPERATION_REPOSITORY,
  NftOperationType,
} from '../../constants';
import { IDeveloperApiKeyRepository } from '../../domain/repositories/developer-api-key.repository.interface';
import { IDeveloperNftOperationRepository } from '../../domain/repositories/developer-nft-operation.repository.interface';
import { DeveloperNftOperation } from '../../domain/entities/developer-nft-operation.entity';
import { DEVELOPER_API_KEY_REPOSITORY } from '../../constants';

export interface BurnNftRequest {
  apiKeyId: string;
  tokenId: string;
  amount?: number;
}

@Injectable()
export class BurnNftUseCase {
  constructor(
    @Inject(DEVELOPER_API_KEY_REPOSITORY)
    private readonly apiKeyRepository: IDeveloperApiKeyRepository,
    @Inject(DEVELOPER_NFT_OPERATION_REPOSITORY)
    private readonly nftOperationRepository: IDeveloperNftOperationRepository,
  ) {}

  async execute(request: BurnNftRequest): Promise<DeveloperNftOperation> {
    const apiKey = await this.apiKeyRepository.findById(request.apiKeyId);
    if (!apiKey) {
      throw new Error('API Key not found');
    }

    const operation = await this.nftOperationRepository.create({
      apiKeyId: request.apiKeyId,
      operationType: NftOperationType.BURN,
      toAddress: null,
      tokenId: request.tokenId,
      amount: request.amount || null,
      metadata: null,
    });

    return operation;
  }
}
