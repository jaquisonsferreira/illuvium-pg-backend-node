import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ThirdwebWebhookMapperService } from './thirdweb-webhook-mapper.service';
import {
  ThirdwebWebhookType,
  ThirdwebWalletCreatedPayload,
  ThirdwebWalletAuthenticatedPayload,
  ThirdwebUserOpExecutedPayload,
} from '../../domain/entities/thirdweb-webhook-payload.entity';
import { UserEventType } from '../../domain/entities/user-event.entity';

describe('ThirdwebWebhookMapperService', () => {
  let service: ThirdwebWebhookMapperService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThirdwebWebhookMapperService],
    }).compile();

    service = module.get<ThirdwebWebhookMapperService>(
      ThirdwebWebhookMapperService,
    );
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('mapToUserEvent', () => {
    it('should map WALLET_CREATED event correctly', () => {
      const payload: ThirdwebWalletCreatedPayload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          account_factory_address: '0x1234567890123456789012345678901234567890',
          chain_id: '1',
          network: 'ethereum',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toEqual({
        type: UserEventType.USER_CREATED,
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
        timestamp: new Date(1609459200000),
        isGuest: false,
        hasAcceptedTerms: false,
        linkedAccounts: [
          {
            type: 'wallet',
            address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
            verified_at: 1609459200000,
            first_verified_at: 1609459200000,
            latest_verified_at: 1609459200000,
          },
        ],
        metadata: {
          walletAddress: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          chainId: '1',
          network: 'ethereum',
          accountFactoryAddress: '0x1234567890123456789012345678901234567890',
        },
      });
    });

    it('should map WALLET_AUTHENTICATED event correctly', () => {
      const payload: ThirdwebWalletAuthenticatedPayload = {
        type: ThirdwebWebhookType.WALLET_AUTHENTICATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          chain_id: '1',
          network: 'ethereum',
          signature: '0xsignature123',
          message: 'Sign in message',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toEqual({
        type: UserEventType.USER_AUTHENTICATED,
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
        timestamp: new Date(1609459200000),
        metadata: {
          walletAddress: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          chainId: '1',
          network: 'ethereum',
          signature: '0xsignature123',
          message: 'Sign in message',
        },
      });
    });

    it('should return null for unsupported webhook types', () => {
      const payload: ThirdwebUserOpExecutedPayload = {
        type: ThirdwebWebhookType.USER_OP_EXECUTED,
        timestamp: 1609459200000,
        data: {
          user_op_hash: '0xhash123',
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          transaction_hash: '0xtxhash123',
          block_number: 12345,
          gas_used: '21000',
          success: true,
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        `Webhook type ${ThirdwebWebhookType.USER_OP_EXECUTED} not currently mapped to internal events`,
      );
    });

    it('should return null for unknown webhook types', () => {
      const payload = {
        type: 'unknown_type',
        timestamp: 1609459200000,
        data: {},
      } as any;

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Unsupported webhook type: unknown_type',
      );
    });

    it('should handle errors gracefully', () => {
      const payload = null as any;

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error mapping webhook payload to user event',
        expect.objectContaining({
          error: expect.any(String),
          payload: 'null',
        }),
      );
    });

    it('should handle wallet creation event with missing timestamp', () => {
      const payload: ThirdwebWalletCreatedPayload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: undefined as any,
        data: {
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          account_factory_address: '0x1234567890123456789012345678901234567890',
          chain_id: '1',
          network: 'ethereum',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toEqual({
        type: UserEventType.USER_CREATED,
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
        timestamp: expect.any(Date),
        isGuest: false,
        hasAcceptedTerms: false,
        linkedAccounts: [
          {
            type: 'wallet',
            address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
            verified_at: expect.any(Number),
            first_verified_at: expect.any(Number),
            latest_verified_at: expect.any(Number),
          },
        ],
        metadata: {
          walletAddress: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          chainId: '1',
          network: 'ethereum',
          accountFactoryAddress: '0x1234567890123456789012345678901234567890',
        },
      });
    });

    it('should convert wallet address to lowercase for userId', () => {
      const payload: ThirdwebWalletCreatedPayload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0X742D35CC6635C0532925A3B8D6E4C2D16C6DB8C1',
          account_factory_address: '0x1234567890123456789012345678901234567890',
          chain_id: '1',
          network: 'ethereum',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result?.userId).toBe('0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1');
    });
  });
});
