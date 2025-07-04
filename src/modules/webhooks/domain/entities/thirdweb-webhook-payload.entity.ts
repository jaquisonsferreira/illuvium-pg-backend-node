export enum ThirdwebWebhookType {
  USER_OP_EXECUTED = 'user_op_executed',
  USER_OP_SUBMITTED = 'user_op_submitted',
  USER_OP_FAILED = 'user_op_failed',
  WALLET_CREATED = 'wallet_created',
  WALLET_AUTHENTICATED = 'wallet_authenticated',
  TOKEN_TRANSFER = 'token_transfer',
  NFT_TRANSFER = 'nft_transfer',
}

export interface ThirdwebWebhookPayload {
  type: ThirdwebWebhookType;
  data: Record<string, any>;
  timestamp: number;
  chain_id?: string;
  network?: string;
}

export interface ThirdwebUser {
  wallet_address: string;
  chain_id?: string;
  network?: string;
  created_at?: number;
  metadata?: Record<string, any>;
}

export interface ThirdwebUserOpExecutedPayload extends ThirdwebWebhookPayload {
  type: ThirdwebWebhookType.USER_OP_EXECUTED;
  data: {
    user_op_hash: string;
    wallet_address: string;
    transaction_hash: string;
    block_number: number;
    gas_used: string;
    success: boolean;
  };
}

export interface ThirdwebUserOpSubmittedPayload extends ThirdwebWebhookPayload {
  type: ThirdwebWebhookType.USER_OP_SUBMITTED;
  data: {
    user_op_hash: string;
    wallet_address: string;
    target: string;
    value: string;
    calldata: string;
  };
}

export interface ThirdwebUserOpFailedPayload extends ThirdwebWebhookPayload {
  type: ThirdwebWebhookType.USER_OP_FAILED;
  data: {
    user_op_hash: string;
    wallet_address: string;
    error: string;
    reason?: string;
  };
}

export interface ThirdwebWalletCreatedPayload extends ThirdwebWebhookPayload {
  type: ThirdwebWebhookType.WALLET_CREATED;
  data: {
    wallet_address: string;
    account_factory_address: string;
    chain_id: string;
    network: string;
  };
}

export interface ThirdwebWalletAuthenticatedPayload
  extends ThirdwebWebhookPayload {
  type: ThirdwebWebhookType.WALLET_AUTHENTICATED;
  data: {
    wallet_address: string;
    chain_id: string;
    network: string;
    signature: string;
    message: string;
  };
}

export interface ThirdwebTokenTransferPayload extends ThirdwebWebhookPayload {
  type: ThirdwebWebhookType.TOKEN_TRANSFER;
  data: {
    from: string;
    to: string;
    value: string;
    token_address: string;
    token_symbol: string;
    token_decimals: number;
    transaction_hash: string;
    block_number: number;
  };
}

export interface ThirdwebNftTransferPayload extends ThirdwebWebhookPayload {
  type: ThirdwebWebhookType.NFT_TRANSFER;
  data: {
    from: string;
    to: string;
    token_id: string;
    contract_address: string;
    token_uri?: string;
    transaction_hash: string;
    block_number: number;
  };
}

export type ThirdwebWebhookPayloadUnion =
  | ThirdwebUserOpExecutedPayload
  | ThirdwebUserOpSubmittedPayload
  | ThirdwebUserOpFailedPayload
  | ThirdwebWalletCreatedPayload
  | ThirdwebWalletAuthenticatedPayload
  | ThirdwebTokenTransferPayload
  | ThirdwebNftTransferPayload;
