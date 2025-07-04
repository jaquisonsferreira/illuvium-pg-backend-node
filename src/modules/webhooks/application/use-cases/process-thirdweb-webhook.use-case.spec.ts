import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ProcessThirdwebWebhookUseCase } from './process-thirdweb-webhook.use-case';
import { WebhookSignatureValidationService } from '../../infrastructure/services/webhook-signature-validation.service';
import { ThirdwebWebhookMapperService } from '../../infrastructure/services/thirdweb-webhook-mapper.service';
import { EventBridgeService } from '../../infrastructure/services/event-bridge.service';
import { ThirdwebWebhookType } from '../../domain/entities/thirdweb-webhook-payload.entity';
import { UserEventType } from '../../domain/entities/user-event.entity';

describe('ProcessThirdwebWebhookUseCase', () => {
  let useCase: ProcessThirdwebWebhookUseCase;
  let signatureValidationService: jest.Mocked<WebhookSignatureValidationService>;
  let mapperService: jest.Mocked<ThirdwebWebhookMapperService>;
  let eventBridgeService: jest.Mocked<EventBridgeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessThirdwebWebhookUseCase,
        {
          provide: WebhookSignatureValidationService,
          useValue: {
            verifySignature: jest.fn(),
          },
        },
        {
          provide: ThirdwebWebhookMapperService,
          useValue: {
            mapToUserEvent: jest.fn(),
          },
        },
        {
          provide: EventBridgeService,
          useValue: {
            sendUserEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<ProcessThirdwebWebhookUseCase>(
      ProcessThirdwebWebhookUseCase,
    );
    signatureValidationService = module.get(WebhookSignatureValidationService);
    mapperService = module.get(ThirdwebWebhookMapperService);
    eventBridgeService = module.get(EventBridgeService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validPayload = JSON.stringify({
      type: ThirdwebWebhookType.WALLET_CREATED,
      timestamp: 1609459200000,
      data: {
        wallet_address: '0x742d35Cc6635C0532925a3b8D6e4C2D16C6Db8c1',
        account_factory_address: '0x1234567890123456789012345678901234567890',
        chain_id: '1',
        network: 'ethereum',
      },
    });

    const validHeaders = {
      'x-thirdweb-signature': 'valid-signature',
      'x-thirdweb-timestamp': '1609459200',
      'content-type': 'application/json',
    };

    it('should process webhook successfully', async () => {
      signatureValidationService.verifySignature.mockReturnValue({
        isValid: true,
      });

      const mockUserEvent = {
        type: UserEventType.USER_CREATED as const,
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
        },
      };

      mapperService.mapToUserEvent.mockReturnValue(mockUserEvent);
      eventBridgeService.sendUserEvent.mockResolvedValue(true);

      const result = await useCase.execute({
        payload: validPayload,
        headers: validHeaders,
      });

      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
        eventType: UserEventType.USER_CREATED,
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
      });

      expect(signatureValidationService.verifySignature).toHaveBeenCalledWith(
        validPayload,
        validHeaders,
      );
      expect(mapperService.mapToUserEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ThirdwebWebhookType.WALLET_CREATED,
        }),
      );
      expect(eventBridgeService.sendUserEvent).toHaveBeenCalledWith(
        mockUserEvent,
      );
    });

    it('should return error when signature validation fails', async () => {
      signatureValidationService.verifySignature.mockReturnValue({
        isValid: false,
        error: 'Invalid signature',
      });

      const result = await useCase.execute({
        payload: validPayload,
        headers: validHeaders,
      });

      expect(result).toEqual({
        success: false,
        message: 'Webhook signature validation failed',
      });

      expect(mapperService.mapToUserEvent).not.toHaveBeenCalled();
      expect(eventBridgeService.sendUserEvent).not.toHaveBeenCalled();
    });

    it('should return error when payload is invalid JSON', async () => {
      signatureValidationService.verifySignature.mockReturnValue({
        isValid: true,
      });

      const result = await useCase.execute({
        payload: 'invalid-json',
        headers: validHeaders,
      });

      expect(result).toEqual({
        success: false,
        message: 'Invalid JSON payload',
      });

      expect(mapperService.mapToUserEvent).not.toHaveBeenCalled();
      expect(eventBridgeService.sendUserEvent).not.toHaveBeenCalled();
    });

    it('should handle webhook types not mapped to events', async () => {
      signatureValidationService.verifySignature.mockReturnValue({
        isValid: true,
      });

      mapperService.mapToUserEvent.mockReturnValue(null);

      const result = await useCase.execute({
        payload: validPayload,
        headers: validHeaders,
      });

      expect(result).toEqual({
        success: true,
        message: 'Webhook received but not mapped to internal event',
        eventType: ThirdwebWebhookType.WALLET_CREATED,
      });

      expect(eventBridgeService.sendUserEvent).not.toHaveBeenCalled();
    });

    it('should return error when EventBridge fails', async () => {
      signatureValidationService.verifySignature.mockReturnValue({
        isValid: true,
      });

      const mockUserEvent = {
        type: UserEventType.USER_CREATED as const,
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
        timestamp: new Date(1609459200000),
        isGuest: false,
        hasAcceptedTerms: false,
        linkedAccounts: [],
        metadata: {},
      };

      mapperService.mapToUserEvent.mockReturnValue(mockUserEvent);
      eventBridgeService.sendUserEvent.mockResolvedValue(false);

      const result = await useCase.execute({
        payload: validPayload,
        headers: validHeaders,
      });

      expect(result).toEqual({
        success: false,
        message: 'Failed to send event to EventBridge',
        eventType: UserEventType.USER_CREATED,
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      signatureValidationService.verifySignature.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await useCase.execute({
        payload: validPayload,
        headers: validHeaders,
      });

      expect(result).toEqual({
        success: false,
        message: 'Internal server error processing webhook',
      });

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Unexpected error processing Thirdweb webhook',
        expect.objectContaining({
          error: 'Unexpected error',
        }),
      );
    });

    it('should log processing metrics', async () => {
      signatureValidationService.verifySignature.mockReturnValue({
        isValid: true,
      });

      const mockUserEvent = {
        type: UserEventType.USER_CREATED as const,
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
        timestamp: new Date(1609459200000),
        isGuest: false,
        hasAcceptedTerms: false,
        linkedAccounts: [],
        metadata: {},
      };

      mapperService.mapToUserEvent.mockReturnValue(mockUserEvent);
      eventBridgeService.sendUserEvent.mockResolvedValue(true);

      await useCase.execute({
        payload: validPayload,
        headers: validHeaders,
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Processing Thirdweb webhook',
        expect.objectContaining({
          payloadLength: validPayload.length,
        }),
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Successfully processed Thirdweb webhook',
        expect.objectContaining({
          eventType: UserEventType.USER_CREATED,
          userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
          processingTimeMs: expect.any(Number),
        }),
      );
    });

    it('should sanitize sensitive headers in logs', async () => {
      const headersWithSensitiveData = {
        ...validHeaders,
        'x-thirdweb-signature': 'sensitive-signature',
        authorization: 'Bearer token',
      };

      signatureValidationService.verifySignature.mockReturnValue({
        isValid: true,
      });

      mapperService.mapToUserEvent.mockReturnValue(null);

      await useCase.execute({
        payload: validPayload,
        headers: headersWithSensitiveData,
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Processing Thirdweb webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-thirdweb-signature': '[REDACTED]',
            authorization: '[REDACTED]',
          }),
        }),
      );
    });
  });
});
