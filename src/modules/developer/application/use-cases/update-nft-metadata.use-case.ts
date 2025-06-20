import { Injectable, Inject } from '@nestjs/common';
import {
  DEVELOPER_NFT_OPERATION_REPOSITORY,
  NftOperationType,
} from '../../constants';
import { IDeveloperApiKeyRepository } from '../../domain/repositories/developer-api-key.repository.interface';
import { IDeveloperNftOperationRepository } from '../../domain/repositories/developer-nft-operation.repository.interface';
import { DeveloperNftOperation } from '../../domain/entities/developer-nft-operation.entity';
import { DEVELOPER_API_KEY_REPOSITORY } from '../../constants';

export interface UpdateNftMetadataRequest {
  apiKeyId: string;
  tokenId: string;
  metadata: Record<string, any>;
}

@Injectable()
export class UpdateNftMetadataUseCase {
  constructor(
    @Inject(DEVELOPER_API_KEY_REPOSITORY)
    private readonly apiKeyRepository: IDeveloperApiKeyRepository,
    @Inject(DEVELOPER_NFT_OPERATION_REPOSITORY)
    private readonly nftOperationRepository: IDeveloperNftOperationRepository,
  ) {}

  async execute(
    request: UpdateNftMetadataRequest,
  ): Promise<DeveloperNftOperation> {
    const apiKey = await this.apiKeyRepository.findById(request.apiKeyId);
    if (!apiKey) {
      throw new Error('API Key not found');
    }

    const operation = await this.nftOperationRepository.create({
      apiKeyId: request.apiKeyId,
      operationType: NftOperationType.UPDATE_METADATA,
      toAddress: null,
      tokenId: request.tokenId,
      amount: null,
      metadata: request.metadata,
    });

    return operation;
  }
}
