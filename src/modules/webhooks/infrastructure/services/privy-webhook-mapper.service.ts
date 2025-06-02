import { Injectable, Logger } from '@nestjs/common';
import {
  PrivyWebhookPayloadUnion,
  PrivyWebhookType,
} from '../../domain/entities/privy-webhook-payload.entity';
import {
  UserEventUnion,
  UserEventType,
  LinkedAccount,
  UserCreatedEvent,
  UserAuthenticatedEvent,
  UserLinkedAccountEvent,
  UserUnlinkedAccountEvent,
  UserUpdatedEvent,
} from '../../domain/entities/user-event.entity';

@Injectable()
export class PrivyWebhookMapperService {
  private readonly logger = new Logger(PrivyWebhookMapperService.name);

  /**
   * Maps a Privy webhook payload to internal user event
   * @param payload - Privy webhook payload
   * @returns Mapped user event or null if not supported
   */
  mapToUserEvent(payload: PrivyWebhookPayloadUnion): UserEventUnion | null {
    try {
      switch (payload.type) {
        case PrivyWebhookType.USER_CREATED:
          return this.mapUserCreatedEvent(payload);

        case PrivyWebhookType.USER_AUTHENTICATED:
          return this.mapUserAuthenticatedEvent(payload);

        case PrivyWebhookType.USER_LINKED_ACCOUNT:
          return this.mapUserLinkedAccountEvent(payload);

        case PrivyWebhookType.USER_UNLINKED_ACCOUNT:
          return this.mapUserUnlinkedAccountEvent(payload);

        case PrivyWebhookType.USER_UPDATED:
          return this.mapUserUpdatedEvent(payload);

        case PrivyWebhookType.USER_TRANSFERRED_ACCOUNT:
        case PrivyWebhookType.USER_WALLET_CREATED:
          this.logger.log(
            `Webhook type ${payload.type} not currently mapped to internal events`,
          );
          return null;

        default:
          this.logger.warn(`Unknown webhook type: ${(payload as any).type}`);
          return null;
      }
    } catch (error) {
      this.logger.error('Error mapping webhook payload to user event', error);
      return null;
    }
  }

  private mapUserCreatedEvent(payload: any): UserCreatedEvent {
    return {
      type: UserEventType.USER_CREATED,
      userId: this.stripPrivyPrefix(payload.user.id),
      timestamp: new Date(payload.user.created_at * 1000),
      isGuest: payload.user.is_guest || false,
      hasAcceptedTerms: payload.user.has_accepted_terms || false,
      linkedAccounts: this.mapLinkedAccounts(
        payload.user.linked_accounts || [],
      ),
    };
  }

  private mapUserAuthenticatedEvent(payload: any): UserAuthenticatedEvent {
    return {
      type: UserEventType.USER_AUTHENTICATED,
      userId: this.stripPrivyPrefix(payload.user.id),
      timestamp: new Date(),
    };
  }

  private mapUserLinkedAccountEvent(payload: any): UserLinkedAccountEvent {
    return {
      type: UserEventType.USER_LINKED_ACCOUNT,
      userId: this.stripPrivyPrefix(payload.user.id),
      timestamp: new Date(),
      linkedAccount: this.mapLinkedAccount(payload.linked_account),
    };
  }

  private mapUserUnlinkedAccountEvent(payload: any): UserUnlinkedAccountEvent {
    return {
      type: UserEventType.USER_UNLINKED_ACCOUNT,
      userId: this.stripPrivyPrefix(payload.user.id),
      timestamp: new Date(),
      unlinkedAccount: this.mapLinkedAccount(payload.linked_account),
    };
  }

  private mapUserUpdatedEvent(payload: any): UserUpdatedEvent {
    return {
      type: UserEventType.USER_UPDATED,
      userId: this.stripPrivyPrefix(payload.user.id),
      timestamp: new Date(),
      changes: {
        isGuest: payload.user.is_guest,
        hasAcceptedTerms: payload.user.has_accepted_terms,
        linkedAccounts: this.mapLinkedAccounts(
          payload.user.linked_accounts || [],
        ),
      },
    };
  }

  /**
   * Maps Privy linked accounts to internal LinkedAccount format
   */
  private mapLinkedAccounts(privyLinkedAccounts: any[]): LinkedAccount[] {
    return privyLinkedAccounts.map((account) => this.mapLinkedAccount(account));
  }

  /**
   * Maps a single Privy linked account to internal LinkedAccount format
   */
  private mapLinkedAccount(privyAccount: any): LinkedAccount {
    const linkedAccount: LinkedAccount = {
      type: privyAccount.type,
    };

    switch (privyAccount.type) {
      case 'wallet':
        linkedAccount.address = privyAccount.address;
        break;
      case 'email':
        linkedAccount.email = privyAccount.address;
        break;
      case 'phone':
        linkedAccount.phone = privyAccount.phoneNumber;
        break;
      case 'google_oauth':
      case 'twitter_oauth':
      case 'discord_oauth':
      case 'github_oauth':
      case 'linkedin_oauth':
      case 'spotify_oauth':
      case 'instagram_oauth':
      case 'tiktok_oauth':
        linkedAccount.subject = privyAccount.subject;
        linkedAccount.email = privyAccount.email;
        linkedAccount.username = privyAccount.username;
        break;
      case 'farcaster':
        linkedAccount.username = privyAccount.username;
        linkedAccount.subject = privyAccount.fid?.toString();
        break;
      case 'telegram':
        linkedAccount.username = privyAccount.username;
        linkedAccount.subject = privyAccount.telegramUserId?.toString();
        break;
    }

    if (privyAccount.verifiedAt) {
      linkedAccount.verified_at = privyAccount.verifiedAt;
    }
    if (privyAccount.firstVerifiedAt) {
      linkedAccount.first_verified_at = privyAccount.firstVerifiedAt;
    }
    if (privyAccount.latestVerifiedAt) {
      linkedAccount.latest_verified_at = privyAccount.latestVerifiedAt;
    }

    return linkedAccount;
  }

  private stripPrivyPrefix(privyId: string): string {
    const prefix = 'did:privy:';
    if (privyId && privyId.startsWith(prefix)) {
      return privyId.substring(prefix.length);
    }
    return privyId;
  }
}
