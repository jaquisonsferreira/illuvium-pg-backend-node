import { DeleteWebhookSubscriptionUseCase } from './delete-webhook-subscription.use-case';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { SvixService } from '../services/svix.service';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';
import {
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';

describe('DeleteWebhookSubscriptionUseCase', () => {
  let useCase: DeleteWebhookSubscriptionUseCase;
  let mockRepository: jest.Mocked<WebhookSubscriptionRepository>;
  let mockSvixService: jest.Mocked<SvixService>;

  const mockSubscription = WebhookSubscriptionEntity.create({
    developerId: 'dev-123',
    svixApplicationId: 'app-123',
    svixEndpointId: 'endpoint-123',
    url: 'https://api.example.com/webhooks',
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

    useCase = new DeleteWebhookSubscriptionUseCase(
      mockRepository,
      mockSvixService,
    );
  });

  describe('execute', () => {
    it('should delete subscription and svix endpoint successfully', async () => {
      mockRepository.findById.mockResolvedValue(mockSubscription);
      mockSvixService.deleteEndpoint.mockResolvedValue(undefined);
      mockRepository.delete.mockResolvedValue(undefined);

      await useCase.execute(mockSubscription.id);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockSubscription.id);
      expect(mockSvixService.deleteEndpoint).toHaveBeenCalledWith(
        mockSubscription.svixApplicationId,
        mockSubscription.svixEndpointId,
      );
      expect(mockRepository.delete).toHaveBeenCalledWith(mockSubscription.id);
    });

    it('should throw error when subscription not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute('non-existent-id')).rejects.toThrow(
        'Webhook subscription not found',
      );

      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent-id');
      expect(mockSvixService.deleteEndpoint).not.toHaveBeenCalled();
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when svix deletion fails', async () => {
      const svixError = new Error('Svix API error');
      mockRepository.findById.mockResolvedValue(mockSubscription);
      mockSvixService.deleteEndpoint.mockRejectedValue(svixError);

      await expect(useCase.execute(mockSubscription.id)).rejects.toThrow(
        svixError,
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when repository deletion fails', async () => {
      const repoError = new Error('Database error');
      mockRepository.findById.mockResolvedValue(mockSubscription);
      mockSvixService.deleteEndpoint.mockResolvedValue(undefined);
      mockRepository.delete.mockRejectedValue(repoError);

      await expect(useCase.execute(mockSubscription.id)).rejects.toThrow(
        repoError,
      );
    });
  });
});
