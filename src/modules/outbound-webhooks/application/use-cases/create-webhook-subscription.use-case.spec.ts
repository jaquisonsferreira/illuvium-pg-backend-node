import { Test, TestingModule } from '@nestjs/testing';
import { CreateWebhookSubscriptionUseCase } from './create-webhook-subscription.use-case';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import { SvixService } from '../services/svix.service';
import {
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';
import { CreateWebhookSubscriptionDto } from '../dtos/create-webhook-subscription.dto';

describe('CreateWebhookSubscriptionUseCase', () => {
  let useCase: CreateWebhookSubscriptionUseCase;
  let repository: jest.Mocked<WebhookSubscriptionRepository>;
  let svixService: jest.Mocked<SvixService>;

  const mockCreateDto: CreateWebhookSubscriptionDto = {
    developerId: 'dev_123',
    url: 'https://test.com/webhooks',
    eventTypes: [WebhookEventType.NFT_TRANSFER, WebhookEventType.NFT_MINT],
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByDeveloperId: jest.fn(),
      findByDeveloperIdAndEventType: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findActiveByEventType: jest.fn(),
    };

    const mockSvixService = {
      createApplication: jest.fn(),
      createEndpoint: jest.fn(),
      deleteEndpoint: jest.fn(),
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateWebhookSubscriptionUseCase,
        {
          provide: 'WebhookSubscriptionRepository',
          useValue: mockRepository,
        },
        {
          provide: SvixService,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<CreateWebhookSubscriptionUseCase>(
      CreateWebhookSubscriptionUseCase,
    );
    repository = module.get('WebhookSubscriptionRepository');
    svixService = module.get(SvixService);
  });

  describe('execute', () => {
    it('should create webhook subscription successfully', async () => {
      const mockSvixApp = { id: 'app_123', name: 'Developer dev_123' };
      const mockSvixEndpoint = {
        id: 'ep_123',
        url: mockCreateDto.url,
        eventTypes: mockCreateDto.eventTypes.map((type) => type.toString()),
      };
      const mockSubscription = {
        id: 'webhook_123',
        developerId: mockCreateDto.developerId,
        svixApplicationId: mockSvixApp.id,
        svixEndpointId: mockSvixEndpoint.id,
        url: mockCreateDto.url,
        eventTypes: mockCreateDto.eventTypes,
        status: WebhookSubscriptionStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      svixService.createApplication.mockResolvedValue(mockSvixApp);
      svixService.createEndpoint.mockResolvedValue(mockSvixEndpoint);
      repository.create.mockResolvedValue(mockSubscription as any);

      const result = await useCase.execute(mockCreateDto);

      expect(svixService.createApplication).toHaveBeenCalledWith(
        mockCreateDto.developerId,
      );
      expect(svixService.createEndpoint).toHaveBeenCalledWith(
        mockSvixApp.id,
        mockCreateDto.url,
        mockCreateDto.eventTypes,
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          developerId: mockCreateDto.developerId,
          svixApplicationId: mockSvixApp.id,
          svixEndpointId: mockSvixEndpoint.id,
          url: mockCreateDto.url,
          eventTypes: mockCreateDto.eventTypes,
          status: WebhookSubscriptionStatus.ACTIVE,
        }),
      );
      expect(result).toEqual(mockSubscription);
    });

    it('should throw error if Svix application creation fails', async () => {
      const error = new Error('Svix API error');
      svixService.createApplication.mockRejectedValue(error);

      await expect(useCase.execute(mockCreateDto)).rejects.toThrow(error);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw error if Svix endpoint creation fails', async () => {
      const mockSvixApp = { id: 'app_123', name: 'Developer dev_123' };
      const error = new Error('Svix endpoint error');

      svixService.createApplication.mockResolvedValue(mockSvixApp);
      svixService.createEndpoint.mockRejectedValue(error);

      await expect(useCase.execute(mockCreateDto)).rejects.toThrow(error);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw error if repository creation fails', async () => {
      const mockSvixApp = { id: 'app_123', name: 'Developer dev_123' };
      const mockSvixEndpoint = {
        id: 'ep_123',
        url: mockCreateDto.url,
        eventTypes: mockCreateDto.eventTypes.map((type) => type.toString()),
      };
      const error = new Error('Database error');

      svixService.createApplication.mockResolvedValue(mockSvixApp);
      svixService.createEndpoint.mockResolvedValue(mockSvixEndpoint);
      repository.create.mockRejectedValue(error);

      await expect(useCase.execute(mockCreateDto)).rejects.toThrow(error);
    });
  });
});
