import { DeveloperNftOperation } from '../entities/developer-nft-operation.entity';
import { NftOperationStatus, NftOperationType } from '../../constants';

export interface CreateNftOperationData {
  apiKeyId: string;
  operationType: NftOperationType;
  toAddress: string | null;
  tokenId: string | null;
  amount: number | null;
  metadata: Record<string, any> | null;
}

export interface UpdateNftOperationData {
  status?: NftOperationStatus;
  transactionHash?: string;
  errorMessage?: string;
  processedAt?: Date;
}

export interface IDeveloperNftOperationRepository {
  create(data: CreateNftOperationData): Promise<DeveloperNftOperation>;
  findById(id: string): Promise<DeveloperNftOperation | null>;
  findByApiKeyId(apiKeyId: string): Promise<DeveloperNftOperation[]>;
  findByStatus(status: NftOperationStatus): Promise<DeveloperNftOperation[]>;
  update(
    id: string,
    data: UpdateNftOperationData,
  ): Promise<DeveloperNftOperation>;
  delete(id: string): Promise<void>;
}
