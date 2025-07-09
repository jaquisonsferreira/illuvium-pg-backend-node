import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ThirdwebWebhookMapperService } from './thirdweb-webhook-mapper.service';
import {
  ThirdwebWebhookType,
  ThirdwebWalletCreatedPayload,
  ThirdwebWalletAuthenticatedPayload,
  ThirdwebUserOpExecutedPayload,
  ThirdwebUserOpSubmittedPayload,
  ThirdwebUserOpFailedPayload,
  ThirdwebTokenTransferPayload,
  ThirdwebNftTransferPayload,
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

      expect(result).toBeDefined();
      expect(result?.type).toBe(UserEventType.USER_CREATED);
      expect(result?.userId).toBe('0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1');
      // Should use current timestamp when none provided
      expect(result?.timestamp).toBeInstanceOf(Date);
      // Cast to UserCreatedEvent to access linkedAccounts
      const createdEvent = result as any;
      expect(createdEvent.linkedAccounts[0].verified_at).toBeGreaterThan(
        Date.now() - 1000,
      ); // Within last second
    });

    it('should handle wallet authentication event with missing timestamp', () => {
      const payload: ThirdwebWalletAuthenticatedPayload = {
        type: ThirdwebWebhookType.WALLET_AUTHENTICATED,
        timestamp: undefined as any,
        data: {
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          chain_id: '1',
          network: 'ethereum',
          signature: '0xsignature123',
          message: 'Sign in message',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeDefined();
      expect(result?.type).toBe(UserEventType.USER_AUTHENTICATED);
      expect(result?.userId).toBe('0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1');
      // Should use current timestamp when none provided
      expect(result?.timestamp).toBeInstanceOf(Date);
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
    it('should return null for TOKEN_TRANSFER webhook type', () => {
      const payload: ThirdwebTokenTransferPayload = {
        type: ThirdwebWebhookType.TOKEN_TRANSFER,
        timestamp: 1609459200000,
        data: {
          from: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          token_address: '0xcontract123',
          token_symbol: 'TEST',
          token_decimals: 18,
          transaction_hash: '0xtxhash123',
          block_number: 123456,
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        `Webhook type ${ThirdwebWebhookType.TOKEN_TRANSFER} not currently mapped to internal events`,
      );
    });

    it('should return null for NFT_TRANSFER webhook type', () => {
      const payload: ThirdwebNftTransferPayload = {
        type: ThirdwebWebhookType.NFT_TRANSFER,
        timestamp: 1609459200000,
        data: {
          from: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          to: '0x1234567890123456789012345678901234567890',
          token_id: '123',
          contract_address: '0xnftcontract123',
          token_uri: 'https://example.com/token/123',
          transaction_hash: '0xtxhash123',
          block_number: 123456,
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        `Webhook type ${ThirdwebWebhookType.NFT_TRANSFER} not currently mapped to internal events`,
      );
    });

    it('should return null for USER_OP_SUBMITTED webhook type', () => {
      const payload: ThirdwebUserOpSubmittedPayload = {
        type: ThirdwebWebhookType.USER_OP_SUBMITTED,
        timestamp: 1609459200000,
        data: {
          user_op_hash: '0xhash123',
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          target: '0xtarget123',
          value: '1000000000000000000',
          calldata: '0xcalldata123',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        `Webhook type ${ThirdwebWebhookType.USER_OP_SUBMITTED} not currently mapped to internal events`,
      );
    });

    it('should return null for USER_OP_FAILED webhook type', () => {
      const payload: ThirdwebUserOpFailedPayload = {
        type: ThirdwebWebhookType.USER_OP_FAILED,
        timestamp: 1609459200000,
        data: {
          user_op_hash: '0xhash123',
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          error: 'Insufficient gas',
          reason: 'Transaction reverted',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        `Webhook type ${ThirdwebWebhookType.USER_OP_FAILED} not currently mapped to internal events`,
      );
    });

    it('should normalize wallet address to lowercase for userId', () => {
      const payload: ThirdwebWalletCreatedPayload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0X742D35CC6635C0532925A3B8D6E4C2D16C6DB8C1', // uppercase
          account_factory_address: '0x1234567890123456789012345678901234567890',
          chain_id: '1',
          network: 'ethereum',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result?.userId).toBe('0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1'); // lowercase
    });

    it('should handle malformed payload data gracefully', () => {
      const payload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: 1609459200000,
        data: null, // malformed data
      } as any;

      const result = service.mapToUserEvent(payload);

      expect(result).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error mapping webhook payload to user event',
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });

    // Test private method indirectly through public interface
    it('should create consistent userId from wallet address (extractUserIdFromWallet coverage)', () => {
      const payload1: ThirdwebWalletCreatedPayload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0X742D35CC6635C0532925A3B8D6E4C2D16C6DB8C1', // uppercase
          account_factory_address: '0x1234567890123456789012345678901234567890',
          chain_id: '1',
          network: 'ethereum',
        },
      };

      const payload2: ThirdwebWalletCreatedPayload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1', // lowercase
          account_factory_address: '0x1234567890123456789012345678901234567890',
          chain_id: '1',
          network: 'ethereum',
        },
      };

      const result1 = service.mapToUserEvent(payload1);
      const result2 = service.mapToUserEvent(payload2);

      // Both should produce the same userId regardless of case
      expect(result1?.userId).toBe(result2?.userId);
      expect(result1?.userId).toBe(
        '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
      );
    });

    it('should handle wallet created event with complex data', () => {
      const payload: ThirdwebWalletCreatedPayload = {
        type: ThirdwebWebhookType.WALLET_CREATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          account_factory_address: '0x1234567890123456789012345678901234567890',
          chain_id: '137', // Polygon
          network: 'polygon',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeDefined();
      expect(result?.type).toBe(UserEventType.USER_CREATED);
      expect(result?.userId).toBe('0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1');
      expect(result?.metadata).toEqual({
        walletAddress: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
        chainId: '137',
        network: 'polygon',
        accountFactoryAddress:
          '0x1234567890123456789012345678901234567890',
      });
    });

    it('should handle wallet authenticated event with complex signature', () => {
      const payload: ThirdwebWalletAuthenticatedPayload = {
        type: ThirdwebWebhookType.WALLET_AUTHENTICATED,
        timestamp: 1609459200000,
        data: {
          wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
          chain_id: '137',
          network: 'polygon',
          signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
          message: 'I am signing this message to authenticate with the dApp. Nonce: 12345 Chain ID: 137',
        },
      };

      const result = service.mapToUserEvent(payload);

      expect(result).toBeDefined();
      expect(result?.type).toBe(UserEventType.USER_AUTHENTICATED);
      expect(result?.userId).toBe('0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1');
      expect(result?.metadata).toEqual({
        walletAddress: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
        chainId: '137',
        network: 'polygon',
        signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
        message: 'I am signing this message to authenticate with the dApp. Nonce: 12345 Chain ID: 137',
      });
    });
  });
});
