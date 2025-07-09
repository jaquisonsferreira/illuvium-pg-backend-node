import { GetWebhookSubscriptionUseCase } from './get-webhook-subscription.use-case';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';
import {
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';

describe('GetWebhookSubscriptionUseCase', () => {
  let useCase: GetWebhookSubscriptionUseCase;
  let mockRepository: jest.Mocked<WebhookSubscriptionRepository>;

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

    useCase = new GetWebhookSubscriptionUseCase(mockRepository);
  });

  describe('execute', () => {
    it('should return subscription when found', async () => {
      mockRepository.findById.mockResolvedValue(mockSubscription);

      const result = await useCase.execute('subscription-123');

      expect(result).toBe(mockSubscription);
      expect(mockRepository.findById).toHaveBeenCalledWith('subscription-123');
    });

    it('should return null when subscription not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute('non-existent-id');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent-id');
    });

    it('should throw error when repository throws', async () => {
      const error = new Error('Database connection failed');
      mockRepository.findById.mockRejectedValue(error);

      await expect(useCase.execute('subscription-123')).rejects.toThrow(error);
    });
  });
});
