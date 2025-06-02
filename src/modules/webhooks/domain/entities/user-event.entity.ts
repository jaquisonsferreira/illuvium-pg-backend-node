export enum UserEventType {
  USER_CREATED = 'user.created',
  USER_AUTHENTICATED = 'user.authenticated',
  USER_LINKED_ACCOUNT = 'user.linked_account',
  USER_UNLINKED_ACCOUNT = 'user.unlinked_account',
  USER_UPDATED = 'user.updated',
}

export interface BaseUserEvent {
  type: UserEventType;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserCreatedEvent extends BaseUserEvent {
  type: UserEventType.USER_CREATED;
  isGuest: boolean;
  hasAcceptedTerms: boolean;
  linkedAccounts: LinkedAccount[];
}

export interface UserAuthenticatedEvent extends BaseUserEvent {
  type: UserEventType.USER_AUTHENTICATED;
}

export interface UserLinkedAccountEvent extends BaseUserEvent {
  type: UserEventType.USER_LINKED_ACCOUNT;
  linkedAccount: LinkedAccount;
}

export interface UserUnlinkedAccountEvent extends BaseUserEvent {
  type: UserEventType.USER_UNLINKED_ACCOUNT;
  unlinkedAccount: LinkedAccount;
}

export interface UserUpdatedEvent extends BaseUserEvent {
  type: UserEventType.USER_UPDATED;
  changes: Record<string, any>;
}

export interface LinkedAccount {
  type: string;
  address?: string;
  email?: string;
  phone?: string;
  username?: string;
  subject?: string;
  verified_at?: number;
  first_verified_at?: number;
  latest_verified_at?: number;
}

export type UserEventUnion =
  | UserCreatedEvent
  | UserAuthenticatedEvent
  | UserLinkedAccountEvent
  | UserUnlinkedAccountEvent
  | UserUpdatedEvent;
