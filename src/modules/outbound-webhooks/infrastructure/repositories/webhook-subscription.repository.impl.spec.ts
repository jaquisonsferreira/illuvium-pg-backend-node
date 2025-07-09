import { Test, TestingModule } from '@nestjs/testing';
import { WebhookSubscriptionRepositoryImpl } from './webhook-subscription.repository.impl';
import {
  WebhookSubscriptionEntity,
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';
import { RepositoryFactory } from '@shared/infrastructure/database';
import { DATABASE_CONNECTION } from '@shared/infrastructure/database';

const mockBaseRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockRepositoryFactory = {
  createRepository: jest.fn(() => mockBaseRepository),
};

const mockDb = {
  selectFrom: jest.fn(() => mockDb),
  selectAll: jest.fn(() => mockDb),
  where: jest.fn(() => mockDb),
  execute: jest.fn(),
};

const mockSubscription = new WebhookSubscriptionEntity(
  'webhook_1751061536098_h3bjr303o',
  'dev_123',
  'app_123',
  'ep_123',
  'https://test.com/webhooks',
  [WebhookEventType.NFT_TRANSFER, WebhookEventType.NFT_MINT],
  WebhookSubscriptionStatus.ACTIVE,
  new Date(2025, 5, 27, 21, 58, 56, 98),
  new Date(2025, 5, 27, 21, 58, 56, 98),
);

describe('WebhookSubscriptionRepositoryImpl', () => {
  let repository: WebhookSubscriptionRepositoryImpl;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        WebhookSubscriptionRepositoryImpl,
        {
          provide: RepositoryFactory,
          useValue: mockRepositoryFactory,
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<WebhookSubscriptionRepositoryImpl>(
      WebhookSubscriptionRepositoryImpl,
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create webhook subscription successfully', async () => {
      mockBaseRepository.create.mockResolvedValue({
        id: mockSubscription.id,
        developer_id: mockSubscription.developerId,
        svix_application_id: mockSubscription.svixApplicationId,
        svix_endpoint_id: mockSubscription.svixEndpointId,
        url: mockSubscription.url,
        event_types: JSON.stringify(mockSubscription.eventTypes),
        status: mockSubscription.status,
        created_at: mockSubscription.createdAt,
        updated_at: mockSubscription.updatedAt,
      });

      const result = await repository.create(mockSubscription);

      expect(mockBaseRepository.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: mockSubscription.id,
        developerId: mockSubscription.developerId,
        svixApplicationId: mockSubscription.svixApplicationId,
        svixEndpointId: mockSubscription.svixEndpointId,
        url: mockSubscription.url,
        eventTypes: mockSubscription.eventTypes,
        status: mockSubscription.status,
        createdAt: mockSubscription.createdAt,
        updatedAt: mockSubscription.updatedAt,
      });
    });
  });

  describe('findById', () => {
    it('should find webhook subscription by id', async () => {
      mockBaseRepository.findById.mockResolvedValue({
        id: mockSubscription.id,
        developer_id: mockSubscription.developerId,
        svix_application_id: mockSubscription.svixApplicationId,
        svix_endpoint_id: mockSubscription.svixEndpointId,
        url: mockSubscription.url,
        event_types: JSON.stringify(mockSubscription.eventTypes),
        status: mockSubscription.status,
        created_at: mockSubscription.createdAt,
        updated_at: mockSubscription.updatedAt,
      });

      const result = await repository.findById(mockSubscription.id);

      expect(mockBaseRepository.findById).toHaveBeenCalledWith(
        mockSubscription.id,
      );
      expect(result).toMatchObject({
        id: mockSubscription.id,
        developerId: mockSubscription.developerId,
        svixApplicationId: mockSubscription.svixApplicationId,
        svixEndpointId: mockSubscription.svixEndpointId,
        url: mockSubscription.url,
        eventTypes: mockSubscription.eventTypes,
        status: mockSubscription.status,
        createdAt: mockSubscription.createdAt,
        updatedAt: mockSubscription.updatedAt,
      });
    });

    it('should return null when webhook subscription not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByDeveloperId', () => {
    it('should find webhook subscriptions by developer id', async () => {
      const mockRows = [
        {
          id: mockSubscription.id,
          developer_id: mockSubscription.developerId,
          svix_application_id: mockSubscription.svixApplicationId,
          svix_endpoint_id: mockSubscription.svixEndpointId,
          url: mockSubscription.url,
          event_types: JSON.stringify(mockSubscription.eventTypes),
          status: mockSubscription.status,
          created_at: mockSubscription.createdAt,
          updated_at: mockSubscription.updatedAt,
        },
      ];

      mockDb.execute.mockResolvedValue(mockRows);

      const result = await repository.findByDeveloperId(
        mockSubscription.developerId,
      );

      expect(mockDb.selectFrom).toHaveBeenCalledWith('webhook_subscriptions');
      expect(mockDb.where).toHaveBeenCalledWith(
        'developer_id',
        '=',
        mockSubscription.developerId,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockSubscription.id,
        developerId: mockSubscription.developerId,
        svixApplicationId: mockSubscription.svixApplicationId,
        svixEndpointId: mockSubscription.svixEndpointId,
        url: mockSubscription.url,
        eventTypes: mockSubscription.eventTypes,
        status: mockSubscription.status,
        createdAt: mockSubscription.createdAt,
        updatedAt: mockSubscription.updatedAt,
      });
    });
  });
});
