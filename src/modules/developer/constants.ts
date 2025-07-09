export const DEVELOPER_API_KEY_REPOSITORY = 'DEVELOPER_API_KEY_REPOSITORY';
export const DEVELOPER_NFT_OPERATION_REPOSITORY =
  'DEVELOPER_NFT_OPERATION_REPOSITORY';

export enum ApiKeyPermission {
  MINTING = 'minting',
  BURNING = 'burning',
  TRANSFER = 'transfer',
  METADATA_UPDATE = 'metadata_update',
  SALES = 'sales',
}

export enum ApiKeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
}

export enum NftOperationType {
  MINT = 'MINT',
  BURN = 'BURN',
  TRANSFER = 'TRANSFER',
  UPDATE_METADATA = 'UPDATE_METADATA',
  SALE = 'SALE',
}

export enum NftOperationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
