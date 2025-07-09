import { ListWebhookSubscriptionsUseCase } from './list-webhook-subscriptions.use-case';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';
import {
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';

describe('ListWebhookSubscriptionsUseCase', () => {
  let useCase: ListWebhookSubscriptionsUseCase;
  let mockRepository: jest.Mocked<WebhookSubscriptionRepository>;

  const mockSubscription1 = WebhookSubscriptionEntity.create({
    developerId: 'dev-123',
    svixApplicationId: 'app-123',
    svixEndpointId: 'endpoint-123',
    url: 'https://api.test.com/webhooks',
    eventTypes: [WebhookEventType.NFT_TRANSFER],
    status: WebhookSubscriptionStatus.ACTIVE,
  });

  const mockSubscription2 = WebhookSubscriptionEntity.create({
    developerId: 'dev-123',
    svixApplicationId: 'app-456',
    svixEndpointId: 'endpoint-456',
    url: 'https://api.test.com/webhooks2',
    eventTypes: [WebhookEventType.NFT_MINT],
    status: WebhookSubscriptionStatus.INACTIVE,
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

    useCase = new ListWebhookSubscriptionsUseCase(mockRepository);
  });

  describe('execute', () => {
    it('should return list of subscriptions for developer', async () => {
      const expected = [mockSubscription1, mockSubscription2];
      mockRepository.findByDeveloperId.mockResolvedValue(expected);

      const result = await useCase.execute('dev-123');

      expect(result).toBe(expected);
      expect(mockRepository.findByDeveloperId).toHaveBeenCalledWith('dev-123');
    });

    it('should return empty array when no subscriptions found', async () => {
      mockRepository.findByDeveloperId.mockResolvedValue([]);

      const result = await useCase.execute('dev-999');

      expect(result).toEqual([]);
      expect(mockRepository.findByDeveloperId).toHaveBeenCalledWith('dev-999');
    });

    it('should throw error when repository throws', async () => {
      const error = new Error('Database connection failed');
      mockRepository.findByDeveloperId.mockRejectedValue(error);

      await expect(useCase.execute('dev-123')).rejects.toThrow(error);
    });
  });
});
