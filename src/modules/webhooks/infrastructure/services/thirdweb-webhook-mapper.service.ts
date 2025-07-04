import { Injectable, Logger } from '@nestjs/common';
import {
  ThirdwebWebhookPayloadUnion,
  ThirdwebWebhookType,
} from '../../domain/entities/thirdweb-webhook-payload.entity';
import {
  UserEventUnion,
  UserEventType,
  UserCreatedEvent,
  UserAuthenticatedEvent,
  LinkedAccount,
} from '../../domain/entities/user-event.entity';

@Injectable()
export class ThirdwebWebhookMapperService {
  private readonly logger = new Logger(ThirdwebWebhookMapperService.name);

  /**
   * Maps a Thirdweb webhook payload to internal user event
   * @param payload - Thirdweb webhook payload
   * @returns Mapped user event or null if not supported
   */
  mapToUserEvent(payload: ThirdwebWebhookPayloadUnion): UserEventUnion | null {
    try {
      switch (payload.type) {
        case ThirdwebWebhookType.WALLET_CREATED:
          return this.mapWalletCreatedEvent(payload);

        case ThirdwebWebhookType.WALLET_AUTHENTICATED:
          return this.mapWalletAuthenticatedEvent(payload);

        case ThirdwebWebhookType.USER_OP_EXECUTED:
        case ThirdwebWebhookType.USER_OP_SUBMITTED:
        case ThirdwebWebhookType.USER_OP_FAILED:
        case ThirdwebWebhookType.TOKEN_TRANSFER:
        case ThirdwebWebhookType.NFT_TRANSFER:
          this.logger.log(
            `Webhook type ${payload.type} not currently mapped to internal events`,
          );
          return null;

        default:
          this.logger.warn(
            `Unsupported webhook type: ${(payload as any).type}`,
          );
          return null;
      }
    } catch (error) {
      this.logger.error('Error mapping webhook payload to user event', {
        error: error.message,
        payload: JSON.stringify(payload),
      });
      return null;
    }
  }

  private mapWalletCreatedEvent(payload: any): UserCreatedEvent {
    const linkedAccount: LinkedAccount = {
      type: 'wallet',
      address: payload.data.wallet_address,
      verified_at: payload.timestamp || Date.now(),
      first_verified_at: payload.timestamp || Date.now(),
      latest_verified_at: payload.timestamp || Date.now(),
    };

    return {
      type: UserEventType.USER_CREATED,
      userId: payload.data.wallet_address.toLowerCase(),
      timestamp: new Date(payload.timestamp || Date.now()),
      isGuest: false,
      hasAcceptedTerms: false,
      linkedAccounts: [linkedAccount],
      metadata: {
        walletAddress: payload.data.wallet_address,
        chainId: payload.data.chain_id,
        network: payload.data.network,
        accountFactoryAddress: payload.data.account_factory_address,
      },
    } as UserCreatedEvent;
  }

  private mapWalletAuthenticatedEvent(payload: any): UserAuthenticatedEvent {
    return {
      type: UserEventType.USER_AUTHENTICATED,
      userId: payload.data.wallet_address.toLowerCase(),
      timestamp: new Date(payload.timestamp || Date.now()),
      metadata: {
        walletAddress: payload.data.wallet_address,
        chainId: payload.data.chain_id,
        network: payload.data.network,
        signature: payload.data.signature,
        message: payload.data.message,
      },
    } as UserAuthenticatedEvent;
  }

  /**
   * Extracts user ID from wallet address
   * For Thirdweb, we'll use the wallet address as the primary identifier
   * This could be enhanced to look up existing users by wallet address
   */
  private extractUserIdFromWallet(walletAddress: string): string {
    // For now, use wallet address as user ID
    // In a real implementation, you might want to:
    // 1. Look up existing user by wallet address
    // 2. Generate a UUID for new users
    // 3. Use a deterministic hash of the wallet address
    return walletAddress.toLowerCase();
  }

  /**
   * Maps Thirdweb linked account data to internal format
   * @param accountData - Thirdweb account data
   * @returns Mapped linked account
   */
  private mapLinkedAccount(accountData: any): LinkedAccount {
    return {
      type: accountData.type,
      address: accountData.address,
      email: accountData.email,
      phone: accountData.phone_number,
      username: accountData.username,
      subject: accountData.subject,
      verified_at: new Date(accountData.created_at || Date.now()).getTime(),
      first_verified_at: new Date(
        accountData.first_verified_at || Date.now(),
      ).getTime(),
      latest_verified_at: new Date(
        accountData.latest_verified_at || Date.now(),
      ).getTime(),
    };
  }

  /**
   * Sanitizes webhook payload for logging
   * @param payload - Webhook payload
   * @returns Sanitized payload
   */
  private sanitizePayloadForLogging(payload: any): any {
    const sanitized = { ...payload };
    // Remove sensitive data like private keys, signatures, etc.
    if (sanitized.data?.signature) {
      sanitized.data.signature = '[REDACTED]';
    }
    if (sanitized.data?.calldata) {
      sanitized.data.calldata = '[REDACTED]';
    }

    return sanitized;
  }
}
