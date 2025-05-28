export enum PrivyWebhookType {
  USER_CREATED = 'user.created',
  USER_AUTHENTICATED = 'user.authenticated',
  USER_LINKED_ACCOUNT = 'user.linked_account',
  USER_UNLINKED_ACCOUNT = 'user.unlinked_account',
  USER_UPDATED = 'user.updated_account',
  USER_TRANSFERRED_ACCOUNT = 'user.transferred_account',
  USER_WALLET_CREATED = 'user.wallet_created',
}

export interface PrivyWebhookPayload {
  type: PrivyWebhookType;
  user: PrivyUser;
}

export interface PrivyUser {
  id: string;
  created_at: number;
  is_guest: boolean;
  has_accepted_terms: boolean;
  linked_accounts: any[];
  mfa_methods: any[];
}

export interface PrivyUserCreatedPayload extends PrivyWebhookPayload {
  type: PrivyWebhookType.USER_CREATED;
}

export interface PrivyUserAuthenticatedPayload extends PrivyWebhookPayload {
  type: PrivyWebhookType.USER_AUTHENTICATED;
}

export interface PrivyUserLinkedAccountPayload extends PrivyWebhookPayload {
  type: PrivyWebhookType.USER_LINKED_ACCOUNT;
  linked_account: any;
}

export interface PrivyUserUnlinkedAccountPayload extends PrivyWebhookPayload {
  type: PrivyWebhookType.USER_UNLINKED_ACCOUNT;
  linked_account: any;
}

export interface PrivyUserUpdatedPayload extends PrivyWebhookPayload {
  type: PrivyWebhookType.USER_UPDATED;
}

export interface PrivyUserTransferredAccountPayload
  extends PrivyWebhookPayload {
  type: PrivyWebhookType.USER_TRANSFERRED_ACCOUNT;
  from_user: PrivyUser;
  to_user: PrivyUser;
}

export interface PrivyUserWalletCreatedPayload extends PrivyWebhookPayload {
  type: PrivyWebhookType.USER_WALLET_CREATED;
  wallet: any;
}

export type PrivyWebhookPayloadUnion =
  | PrivyUserCreatedPayload
  | PrivyUserAuthenticatedPayload
  | PrivyUserLinkedAccountPayload
  | PrivyUserUnlinkedAccountPayload
  | PrivyUserUpdatedPayload
  | PrivyUserTransferredAccountPayload
  | PrivyUserWalletCreatedPayload;
