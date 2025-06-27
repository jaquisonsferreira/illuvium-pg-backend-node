import { Inject, Injectable } from '@nestjs/common';
import {
  WebhookSubscription as DbWebhookSubscription,
  Database,
  NewWebhookSubscription,
  WebhookSubscriptionUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';
import { WebhookSubscriptionRepository } from '../../domain/repositories/webhook-subscription.repository';
import {
  WebhookSubscriptionEntity,
  WebhookEventType,
  WebhookSubscriptionStatus,
} from '../../domain/entities/webhook-subscription.entity';

@Injectable()
export class WebhookSubscriptionRepositoryImpl
  implements WebhookSubscriptionRepository
{
  private repository: BaseRepository<
    'webhook_subscriptions',
    DbWebhookSubscription,
    NewWebhookSubscription,
    WebhookSubscriptionUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'webhook_subscriptions',
      DbWebhookSubscription,
      NewWebhookSubscription,
      WebhookSubscriptionUpdate
    >('webhook_subscriptions');
  }

  async create(
    subscription: WebhookSubscriptionEntity,
  ): Promise<WebhookSubscriptionEntity> {
    const newSubscription: NewWebhookSubscription = {
      id: subscription.id,
      developer_id: subscription.developerId,
      svix_application_id: subscription.svixApplicationId,
      svix_endpoint_id: subscription.svixEndpointId,
      url: subscription.url,
      event_types: JSON.stringify(subscription.eventTypes),
      status: subscription.status,
    };

    const dbSubscription = await this.repository.create(newSubscription);
    return this.toDomainEntity(dbSubscription);
  }

  async findById(id: string): Promise<WebhookSubscriptionEntity | null> {
    const dbSubscription = await this.repository.findById(id);
    if (!dbSubscription) {
      return null;
    }
    return this.toDomainEntity(dbSubscription);
  }

  async findByDeveloperId(
    developerId: string,
  ): Promise<WebhookSubscriptionEntity[]> {
    const dbSubscriptions = await this.db
      .selectFrom('webhook_subscriptions')
      .selectAll()
      .where('developer_id', '=', developerId)
      .execute();

    return dbSubscriptions.map((dbSubscription) =>
      this.toDomainEntity(dbSubscription),
    );
  }

  async findByDeveloperIdAndEventType(
    developerId: string,
    eventType: string,
  ): Promise<WebhookSubscriptionEntity[]> {
    const dbSubscriptions = await this.db
      .selectFrom('webhook_subscriptions')
      .selectAll()
      .where('developer_id', '=', developerId)
      .where('event_types', 'like', `%"${eventType}"%`)
      .execute();

    return dbSubscriptions.map((dbSubscription) =>
      this.toDomainEntity(dbSubscription),
    );
  }

  async update(
    subscription: WebhookSubscriptionEntity,
  ): Promise<WebhookSubscriptionEntity> {
    const updateData: WebhookSubscriptionUpdate = {
      url: subscription.url,
      event_types: JSON.stringify(subscription.eventTypes),
      status: subscription.status,
    };

    const dbSubscription = await this.repository.update(
      subscription.id,
      updateData,
    );
    if (!dbSubscription) {
      throw new Error('Failed to update subscription');
    }
    return this.toDomainEntity(dbSubscription);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findActiveByEventType(
    eventType: string,
  ): Promise<WebhookSubscriptionEntity[]> {
    const dbSubscriptions = await this.db
      .selectFrom('webhook_subscriptions')
      .selectAll()
      .where('status', '=', WebhookSubscriptionStatus.ACTIVE)
      .where('event_types', 'like', `%"${eventType}"%`)
      .execute();

    return dbSubscriptions.map((dbSubscription) =>
      this.toDomainEntity(dbSubscription),
    );
  }

  private toDomainEntity(
    dbSubscription: DbWebhookSubscription,
  ): WebhookSubscriptionEntity {
    return {
      id: dbSubscription.id,
      developerId: dbSubscription.developer_id,
      svixApplicationId: dbSubscription.svix_application_id,
      svixEndpointId: dbSubscription.svix_endpoint_id,
      url: dbSubscription.url,
      eventTypes: JSON.parse(dbSubscription.event_types) as WebhookEventType[],
      status: dbSubscription.status as WebhookSubscriptionStatus,
      createdAt: dbSubscription.created_at,
      updatedAt: dbSubscription.updated_at,
      isActive: function () {
        return this.status === WebhookSubscriptionStatus.ACTIVE;
      },
      containsEventType: function (eventType: WebhookEventType) {
        return this.eventTypes.includes(eventType);
      },
      updateStatus: function (status: WebhookSubscriptionStatus) {
        return {
          ...this,
          status,
          updatedAt: new Date(),
        } as WebhookSubscriptionEntity;
      },
      updateEventTypes: function (eventTypes: WebhookEventType[]) {
        return {
          ...this,
          eventTypes,
          updatedAt: new Date(),
        } as WebhookSubscriptionEntity;
      },
    } as WebhookSubscriptionEntity;
  }
}
