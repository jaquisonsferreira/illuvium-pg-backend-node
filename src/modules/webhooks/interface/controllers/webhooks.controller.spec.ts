import { Test, TestingModule } from '@nestjs/testing';
import {
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ProcessThirdwebWebhookUseCase } from '../../application/use-cases/process-thirdweb-webhook.use-case';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let processThirdwebWebhookUseCase: jest.Mocked<ProcessThirdwebWebhookUseCase>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: ProcessThirdwebWebhookUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    processThirdwebWebhookUseCase = module.get(ProcessThirdwebWebhookUseCase);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('receiveThirdwebWebhook', () => {
    const validHeaders = {
      'x-thirdweb-signature': 'valid-signature',
      'x-thirdweb-timestamp': '1609459200',
      'content-type': 'application/json',
    };

    const mockRequest = {
      rawBody: Buffer.from(
        '{"type": "wallet_created", "timestamp": 1609459200000}',
      ),
    } as any;

    it('should process Thirdweb webhook successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Webhook processed successfully',
        eventType: 'wallet_created',
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
      };

      processThirdwebWebhookUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.receiveThirdwebWebhook(
        mockRequest,
        validHeaders,
      );

      expect(result).toEqual({
        message: 'Webhook processed successfully',
        success: true,
      });

      expect(processThirdwebWebhookUseCase.execute).toHaveBeenCalledWith({
        payload: '{"type": "wallet_created", "timestamp": 1609459200000}',
        headers: validHeaders,
      });
    });

    it('should throw BadRequestException when raw body is missing', async () => {
      const requestWithoutBody = { rawBody: null } as any;

      await expect(
        controller.receiveThirdwebWebhook(requestWithoutBody, validHeaders),
      ).rejects.toThrow(BadRequestException);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Raw body not available for webhook signature verification',
      );
    });

    it('should throw BadRequestException when required Thirdweb headers are missing', async () => {
      const invalidHeaders = {
        'content-type': 'application/json',
      };

      await expect(
        controller.receiveThirdwebWebhook(mockRequest, invalidHeaders),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept alternative header names for Thirdweb', async () => {
      const alternativeHeaders = {
        'x-signature': 'valid-signature',
        timestamp: '1609459200',
        'content-type': 'application/json',
      };

      const mockResult = {
        success: true,
        message: 'Webhook processed successfully',
        eventType: 'wallet_created',
        userId: '0x742d35cc6635c0532925a3b8d6e4c2d16c6db8c1',
      };

      processThirdwebWebhookUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.receiveThirdwebWebhook(
        mockRequest,
        alternativeHeaders,
      );

      expect(result).toEqual({
        message: 'Webhook processed successfully',
        success: true,
      });
    });

    it('should throw InternalServerErrorException when Thirdweb use case fails', async () => {
      const mockResult = {
        success: false,
        message: 'Processing failed',
      };

      processThirdwebWebhookUseCase.execute.mockResolvedValue(mockResult);

      await expect(
        controller.receiveThirdwebWebhook(mockRequest, validHeaders),
      ).rejects.toThrow(InternalServerErrorException);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Thirdweb webhook processing failed',
        expect.objectContaining({
          message: 'Processing failed',
        }),
      );
    });

    it('should handle unexpected errors in Thirdweb webhook', async () => {
      processThirdwebWebhookUseCase.execute.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(
        controller.receiveThirdwebWebhook(mockRequest, validHeaders),
      ).rejects.toThrow(InternalServerErrorException);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error in Thirdweb webhook controller',
        expect.objectContaining({
          error: 'Unexpected error',
        }),
      );
    });
  });

  describe('testWebhook', () => {
    it('should return test webhook response', async () => {
      const mockBody = { test: 'data' };
      const mockHeaders = { 'content-type': 'application/json' };

      const result = await controller.testWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        message: 'Test webhook received successfully',
        received: {
          headers: mockHeaders,
          body: mockBody,
          timestamp: expect.any(String),
        },
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Test webhook received',
        expect.objectContaining({
          headers: Object.keys(mockHeaders),
          bodyType: 'object',
          bodyKeys: ['test'],
        }),
      );
    });

    it('should handle non-object body', async () => {
      const mockBody = 'string body';
      const mockHeaders = { 'content-type': 'text/plain' };

      const result = await controller.testWebhook(mockBody, mockHeaders);

      expect(result).toEqual({
        message: 'Test webhook received successfully',
        received: {
          headers: mockHeaders,
          body: mockBody,
          timestamp: expect.any(String),
        },
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Test webhook received',
        expect.objectContaining({
          bodyType: 'string',
          bodyKeys: [],
        }),
      );
    });
  });

  describe('validateThirdwebWebhookHeaders', () => {
    it('should pass validation with all required Thirdweb headers', () => {
      const validHeaders = {
        'x-thirdweb-signature': 'valid-signature',
        'x-thirdweb-timestamp': '1609459200',
      };

      expect(() => {
        (controller as any).validateThirdwebWebhookHeaders(validHeaders);
      }).not.toThrow();
    });

    it('should pass validation with alternative Thirdweb header names', () => {
      const validHeaders = {
        'x-signature': 'valid-signature',
        timestamp: '1609459200',
      };

      expect(() => {
        (controller as any).validateThirdwebWebhookHeaders(validHeaders);
      }).not.toThrow();
    });

    it('should throw BadRequestException when signature header is missing', () => {
      const invalidHeaders = {
        'x-thirdweb-timestamp': '1609459200',
      };

      expect(() => {
        (controller as any).validateThirdwebWebhookHeaders(invalidHeaders);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when timestamp header is missing', () => {
      const invalidHeaders = {
        'x-thirdweb-signature': 'valid-signature',
      };

      expect(() => {
        (controller as any).validateThirdwebWebhookHeaders(invalidHeaders);
      }).toThrow(BadRequestException);
    });
  });
});
