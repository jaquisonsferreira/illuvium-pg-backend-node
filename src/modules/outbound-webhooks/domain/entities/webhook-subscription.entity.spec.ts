import {
  WebhookSubscriptionEntity,
  WebhookEventType,
  WebhookSubscriptionStatus,
} from './webhook-subscription.entity';

describe('WebhookSubscriptionEntity', () => {
  const mockData = {
    developerId: 'dev_123',
    svixApplicationId: 'app_123',
    svixEndpointId: 'ep_123',
    url: 'https://test.com/webhooks',
    eventTypes: [WebhookEventType.NFT_TRANSFER, WebhookEventType.NFT_MINT],
    status: WebhookSubscriptionStatus.ACTIVE,
  };

  describe('create', () => {
    it('should create a new webhook subscription with generated id and timestamps', () => {
      const subscription = WebhookSubscriptionEntity.create(mockData);

      expect(subscription.id).toMatch(/^webhook_\d+_[a-z0-9]+$/);
      expect(subscription.developerId).toBe(mockData.developerId);
      expect(subscription.svixApplicationId).toBe(mockData.svixApplicationId);
      expect(subscription.svixEndpointId).toBe(mockData.svixEndpointId);
      expect(subscription.url).toBe(mockData.url);
      expect(subscription.eventTypes).toEqual(mockData.eventTypes);
      expect(subscription.status).toBe(mockData.status);
      expect(subscription.createdAt).toBeInstanceOf(Date);
      expect(subscription.updatedAt).toBeInstanceOf(Date);
      expect(subscription.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(subscription.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should create different ids for different instances', () => {
      const subscription1 = WebhookSubscriptionEntity.create(mockData);
      const subscription2 = WebhookSubscriptionEntity.create(mockData);

      expect(subscription1.id).not.toBe(subscription2.id);
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should update status and updatedAt timestamp', () => {
      const subscription = WebhookSubscriptionEntity.create(mockData);
      const originalUpdatedAt = subscription.updatedAt;

      // Advance time to ensure different timestamp
      jest.advanceTimersByTime(1000);
      const newStatus = WebhookSubscriptionStatus.PAUSED;
      const updatedSubscription = subscription.updateStatus(newStatus);

      expect(updatedSubscription.status).toBe(newStatus);
      expect(updatedSubscription.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
      expect(updatedSubscription.id).toBe(subscription.id);
      expect(updatedSubscription.createdAt).toEqual(subscription.createdAt);
    });

    it('should not modify original instance', () => {
      const subscription = WebhookSubscriptionEntity.create(mockData);
      const originalStatus = subscription.status;

      subscription.updateStatus(WebhookSubscriptionStatus.PAUSED);

      expect(subscription.status).toBe(originalStatus);
    });
  });

  describe('updateEventTypes', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should update event types and updatedAt timestamp', () => {
      const subscription = WebhookSubscriptionEntity.create(mockData);
      const originalUpdatedAt = subscription.updatedAt;
      const newEventTypes = [
        WebhookEventType.NFT_BURN,
        WebhookEventType.COLLECTION_PAUSED,
      ];

      // Advance time to ensure different timestamp
      jest.advanceTimersByTime(1000);
      const updatedSubscription = subscription.updateEventTypes(newEventTypes);

      expect(updatedSubscription.eventTypes).toEqual(newEventTypes);
      expect(updatedSubscription.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
      expect(updatedSubscription.id).toBe(subscription.id);
      expect(updatedSubscription.createdAt).toEqual(subscription.createdAt);
    });

    it('should not modify original instance', () => {
      const subscription = WebhookSubscriptionEntity.create(mockData);
      const originalEventTypes = subscription.eventTypes;

      subscription.updateEventTypes([WebhookEventType.NFT_BURN]);

      expect(subscription.eventTypes).toEqual(originalEventTypes);
    });
  });

  describe('isActive', () => {
    it('should return true when status is ACTIVE', () => {
      const subscription = WebhookSubscriptionEntity.create({
        ...mockData,
        status: WebhookSubscriptionStatus.ACTIVE,
      });

      expect(subscription.isActive()).toBe(true);
    });

    it('should return false when status is not ACTIVE', () => {
      const inactiveSubscription = WebhookSubscriptionEntity.create({
        ...mockData,
        status: WebhookSubscriptionStatus.INACTIVE,
      });

      const pausedSubscription = WebhookSubscriptionEntity.create({
        ...mockData,
        status: WebhookSubscriptionStatus.PAUSED,
      });

      expect(inactiveSubscription.isActive()).toBe(false);
      expect(pausedSubscription.isActive()).toBe(false);
    });
  });

  describe('containsEventType', () => {
    it('should return true if event type is included', () => {
      const subscription = WebhookSubscriptionEntity.create(mockData);

      expect(
        subscription.containsEventType(WebhookEventType.NFT_TRANSFER),
      ).toBe(true);
      expect(subscription.containsEventType(WebhookEventType.NFT_MINT)).toBe(
        true,
      );
    });

    it('should return false if event type is not included', () => {
      const subscription = WebhookSubscriptionEntity.create(mockData);

      expect(subscription.containsEventType(WebhookEventType.NFT_BURN)).toBe(
        false,
      );
      expect(
        subscription.containsEventType(WebhookEventType.COLLECTION_PAUSED),
      ).toBe(false);
    });
  });
});
