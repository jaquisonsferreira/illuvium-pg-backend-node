import { Injectable } from '@nestjs/common';
import { Svix } from 'svix';
import { WebhookEventType } from '../../domain/entities/webhook-subscription.entity';

export interface SvixApplication {
  id: string;
  name: string;
}

export interface SvixEndpoint {
  id: string;
  url: string;
  eventTypes: string[];
}

export interface SvixMessage {
  eventType: string;
  payload: Record<string, any>;
}

export interface SvixEventType {
  name: string;
  description?: string;
  archived?: boolean;
}

@Injectable()
export class SvixService {
  private svix: Svix;

  constructor() {
    const svixToken = process.env.SVIX_TOKEN;
    if (!svixToken) {
      throw new Error('SVIX_TOKEN environment variable is required');
    }
    this.svix = new Svix(svixToken);
  }

  async createApplication(developerId: string): Promise<SvixApplication> {
    const application = await this.svix.application.create({
      name: `Developer ${developerId}`,
      uid: developerId,
    });

    return {
      id: application.id,
      name: application.name,
    };
  }

  async createEndpoint(
    applicationId: string,
    url: string,
    eventTypes: WebhookEventType[],
  ): Promise<SvixEndpoint> {
    const endpoint = await this.svix.endpoint.create(applicationId, {
      url,
    });

    return {
      id: endpoint.id,
      url: endpoint.url,
      eventTypes: eventTypes.map((type) => type.toString()),
    };
  }

  async deleteEndpoint(
    applicationId: string,
    endpointId: string,
  ): Promise<void> {
    await this.svix.endpoint.delete(applicationId, endpointId);
  }

  async sendMessage(
    applicationId: string,
    message: SvixMessage,
  ): Promise<void> {
    await this.svix.message.create(applicationId, {
      eventType: message.eventType,
      payload: message.payload,
    });
  }

  async updateEndpoint(
    applicationId: string,
    endpointId: string,
    url: string,
    eventTypes: WebhookEventType[],
  ): Promise<SvixEndpoint> {
    const endpoint = await this.svix.endpoint.update(
      applicationId,
      endpointId,
      {
        url,
      },
    );

    return {
      id: endpoint.id,
      url: endpoint.url,
      eventTypes: eventTypes.map((type) => type.toString()),
    };
  }

  async createEventType(
    eventTypeName: string,
    description?: string,
  ): Promise<SvixEventType> {
    const createData: any = {
      name: eventTypeName,
    };

    if (description) {
      createData.description = description;
    }

    const eventType = await this.svix.eventType.create(createData);

    return {
      name: eventType.name,
      description: eventType.description,
      archived: eventType.archived,
    };
  }

  async listEventTypes(): Promise<SvixEventType[]> {
    const response = await this.svix.eventType.list();

    return response.data.map((eventType) => ({
      name: eventType.name,
      description: eventType.description,
      archived: eventType.archived,
    }));
  }

  async updateEventType(
    eventTypeName: string,
    description?: string,
    archived?: boolean,
  ): Promise<SvixEventType> {
    const updateData: any = {};

    if (description !== undefined) {
      updateData.description = description;
    }

    if (archived !== undefined) {
      updateData.archived = archived;
    }

    const eventType = await this.svix.eventType.update(
      eventTypeName,
      updateData,
    );

    return {
      name: eventType.name,
      description: eventType.description,
      archived: eventType.archived,
    };
  }

  async deleteEventType(eventTypeName: string): Promise<void> {
    await this.svix.eventType.delete(eventTypeName);
  }
}
