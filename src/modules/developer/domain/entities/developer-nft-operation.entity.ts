import { NftOperationType, NftOperationStatus } from '../../constants';

export class DeveloperNftOperation {
  constructor(
    public readonly id: string,
    public readonly apiKeyId: string,
    public readonly operationType: NftOperationType,
    public readonly status: NftOperationStatus,
    public readonly toAddress: string | null,
    public readonly tokenId: string | null,
    public readonly amount: number | null,
    public readonly metadata: Record<string, any> | null,
    public readonly transactionHash: string | null,
    public readonly errorMessage: string | null,
    public readonly processedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(
    apiKeyId: string,
    operationType: NftOperationType,
    toAddress?: string,
    tokenId?: string,
    amount?: number,
    metadata?: Record<string, any>,
  ): DeveloperNftOperation {
    const now = new Date();
    const id = crypto.randomUUID();

    return new DeveloperNftOperation(
      id,
      apiKeyId,
      operationType,
      NftOperationStatus.PENDING,
      toAddress || null,
      tokenId || null,
      amount || null,
      metadata || null,
      null,
      null,
      null,
      now,
      now,
    );
  }

  isPending(): boolean {
    return this.status === NftOperationStatus.PENDING;
  }

  isCompleted(): boolean {
    return this.status === NftOperationStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === NftOperationStatus.FAILED;
  }

  isProcessing(): boolean {
    return this.status === NftOperationStatus.PROCESSING;
  }

  canBeRetried(): boolean {
    return this.status === NftOperationStatus.FAILED;
  }

  getDisplayName(): string {
    switch (this.operationType) {
      case NftOperationType.MINT:
        return 'NFT Minting';
      case NftOperationType.BURN:
        return 'NFT Burning';
      case NftOperationType.TRANSFER:
        return 'NFT Transfer';
      case NftOperationType.UPDATE_METADATA:
        return 'NFT Metadata Update';
      case NftOperationType.SALE:
        return 'NFT Sale';
      default:
        return 'Unknown Operation';
    }
  }
}
