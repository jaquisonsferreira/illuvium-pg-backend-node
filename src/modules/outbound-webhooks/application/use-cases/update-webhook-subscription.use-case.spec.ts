import { UpdateWebhookSubscriptionUseCase } from './update-webhook-subscription.use-case';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { SvixService } from '../services/svix.service';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';
import {
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';
import { UpdateWebhookSubscriptionDto } from '../dtos/update-webhook-subscription.dto';

describe('UpdateWebhookSubscriptionUseCase', () => {
  let useCase: UpdateWebhookSubscriptionUseCase;
  let mockRepository: jest.Mocked<WebhookSubscriptionRepository>;
  let mockSvixService: jest.Mocked<SvixService>;

  const mockSubscription = WebhookSubscriptionEntity.create({
    developerId: 'dev-123',
    svixApplicationId: 'app-123',
    svixEndpointId: 'endpoint-123',
    url: 'https://api.test.com/webhooks',
    eventTypes: [WebhookEventType.NFT_TRANSFER],
    status: WebhookSubscriptionStatus.ACTIVE,
  });

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByDeveloperId: jest.fn(),
      findByDeveloperIdAndEventType: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findActiveByEventType: jest.fn(),
    };

    mockSvixService = {
      createApplication: jest.fn(),
      createEndpoint: jest.fn(),
      updateEndpoint: jest.fn(),
      deleteEndpoint: jest.fn(),
      sendMessage: jest.fn(),
    } as any;

    useCase = new UpdateWebhookSubscriptionUseCase(
      mockRepository,
      mockSvixService,
    );
  });

  describe('execute', () => {
    it('should update subscription successfully', async () => {
      const updateDto: UpdateWebhookSubscriptionDto = {
        url: 'https://api.test.com/new-webhooks',
        eventTypes: [WebhookEventType.NFT_MINT, WebhookEventType.NFT_BURN],
        status: WebhookSubscriptionStatus.INACTIVE,
      };

      const updatedSubscription = mockSubscription.updateEventTypes(
        updateDto.eventTypes || [],
      );

      mockRepository.findById.mockResolvedValue(mockSubscription);
      mockSvixService.updateEndpoint.mockResolvedValue({
        id: 'endpoint-123',
        url: updateDto.url!,
        eventTypes: updateDto.eventTypes!.map((type) => type.toString()),
      });
      mockRepository.update.mockResolvedValue(updatedSubscription);

      const result = await useCase.execute(mockSubscription.id, updateDto);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockSubscription.id);
      expect(mockSvixService.updateEndpoint).toHaveBeenCalledWith(
        mockSubscription.svixApplicationId,
        mockSubscription.svixEndpointId,
        updateDto.url,
        updateDto.eventTypes,
      );
      expect(mockRepository.update).toHaveBeenCalled();
      expect(result).toBe(updatedSubscription);
    });

    it('should throw error when subscription not found', async () => {
      const updateDto: UpdateWebhookSubscriptionDto = {
        url: 'https://api.test.com/new-webhooks',
        eventTypes: [WebhookEventType.NFT_MINT],
        status: WebhookSubscriptionStatus.INACTIVE,
      };

      mockRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('non-existent-id', updateDto),
      ).rejects.toThrow('Webhook subscription not found');

      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(mockSvixService.updateEndpoint).not.toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when svix update fails', async () => {
      const updateDto: UpdateWebhookSubscriptionDto = {
        url: 'https://api.test.com/new-webhooks',
        eventTypes: [WebhookEventType.NFT_MINT],
        status: WebhookSubscriptionStatus.INACTIVE,
      };

      const svixError = new Error('Svix API error');
      mockRepository.findById.mockResolvedValue(mockSubscription);
      mockSvixService.updateEndpoint.mockRejectedValue(svixError);

      await expect(
        useCase.execute(mockSubscription.id, updateDto),
      ).rejects.toThrow(svixError);

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when repository update fails', async () => {
      const updateDto: UpdateWebhookSubscriptionDto = {
        url: 'https://api.test.com/new-webhooks',
        eventTypes: [WebhookEventType.NFT_MINT],
        status: WebhookSubscriptionStatus.INACTIVE,
      };

      const repoError = new Error('Database error');
      mockRepository.findById.mockResolvedValue(mockSubscription);
      mockSvixService.updateEndpoint.mockResolvedValue({
        id: 'endpoint-123',
        url: updateDto.url!,
        eventTypes: updateDto.eventTypes!.map((type) => type.toString()),
      });
      mockRepository.update.mockRejectedValue(repoError);

      await expect(
        useCase.execute(mockSubscription.id, updateDto),
      ).rejects.toThrow(repoError);
    });
  });
});
