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
}
