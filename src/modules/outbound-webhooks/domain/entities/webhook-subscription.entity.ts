export enum WebhookEventType {
  NFT_TRANSFER = 'nft.transfer',
  NFT_MINT = 'nft.mint',
  NFT_BURN = 'nft.burn',
  COLLECTION_PAUSED = 'collection.paused',
  COLLECTION_UNPAUSED = 'collection.unpaused',
}

export enum WebhookSubscriptionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PAUSED = 'PAUSED',
}

export interface WebhookSubscription {
  id: string;
  developerId: string;
  svixApplicationId: string;
  svixEndpointId: string;
  url: string;
  eventTypes: WebhookEventType[];
  status: WebhookSubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookSubscriptionEntity implements WebhookSubscription {
  constructor(
    public readonly id: string,
    public readonly developerId: string,
    public readonly svixApplicationId: string,
    public readonly svixEndpointId: string,
    public readonly url: string,
    public readonly eventTypes: WebhookEventType[],
    public readonly status: WebhookSubscriptionStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(
    data: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>,
  ): WebhookSubscriptionEntity {
    const now = new Date();
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new WebhookSubscriptionEntity(
      id,
      data.developerId,
      data.svixApplicationId,
      data.svixEndpointId,
      data.url,
      data.eventTypes,
      data.status,
      now,
      now,
    );
  }

  updateStatus(status: WebhookSubscriptionStatus): WebhookSubscriptionEntity {
    return new WebhookSubscriptionEntity(
      this.id,
      this.developerId,
      this.svixApplicationId,
      this.svixEndpointId,
      this.url,
      this.eventTypes,
      status,
      this.createdAt,
      new Date(),
    );
  }

  updateEventTypes(eventTypes: WebhookEventType[]): WebhookSubscriptionEntity {
    return new WebhookSubscriptionEntity(
      this.id,
      this.developerId,
      this.svixApplicationId,
      this.svixEndpointId,
      this.url,
      eventTypes,
      this.status,
      this.createdAt,
      new Date(),
    );
  }

  updateUrl(url: string): WebhookSubscriptionEntity {
    return new WebhookSubscriptionEntity(
      this.id,
      this.developerId,
      this.svixApplicationId,
      this.svixEndpointId,
      url,
      this.eventTypes,
      this.status,
      this.createdAt,
      new Date(),
    );
  }

  isActive(): boolean {
    return this.status === WebhookSubscriptionStatus.ACTIVE;
  }

  containsEventType(eventType: WebhookEventType): boolean {
    return this.eventTypes.includes(eventType);
  }
}
