import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateWebhookSubscriptionUseCase } from '../../application/use-cases/create-webhook-subscription.use-case';
import { GetWebhookSubscriptionUseCase } from '../../application/use-cases/get-webhook-subscription.use-case';
import { ListWebhookSubscriptionsUseCase } from '../../application/use-cases/list-webhook-subscriptions.use-case';
import { UpdateWebhookSubscriptionUseCase } from '../../application/use-cases/update-webhook-subscription.use-case';
import { DeleteWebhookSubscriptionUseCase } from '../../application/use-cases/delete-webhook-subscription.use-case';
import { CreateWebhookSubscriptionDto } from '../../application/dtos/create-webhook-subscription.dto';
import { UpdateWebhookSubscriptionDto } from '../../application/dtos/update-webhook-subscription.dto';
import { WebhookSubscriptionEntity } from '../../domain/entities/webhook-subscription.entity';

@Controller('webhook-subscriptions')
export class WebhookSubscriptionController {
  constructor(
    private readonly createWebhookSubscriptionUseCase: CreateWebhookSubscriptionUseCase,
    private readonly getWebhookSubscriptionUseCase: GetWebhookSubscriptionUseCase,
    private readonly listWebhookSubscriptionsUseCase: ListWebhookSubscriptionsUseCase,
    private readonly updateWebhookSubscriptionUseCase: UpdateWebhookSubscriptionUseCase,
    private readonly deleteWebhookSubscriptionUseCase: DeleteWebhookSubscriptionUseCase,
  ) {}

  @Post()
  async create(
    @Body() createDto: CreateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionEntity> {
    return this.createWebhookSubscriptionUseCase.execute(createDto);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<WebhookSubscriptionEntity> {
    const result = await this.getWebhookSubscriptionUseCase.execute(id);
    if (!result) {
      throw new NotFoundException(
        `Webhook subscription with id ${id} not found`,
      );
    }
    return result;
  }

  @Get()
  async findByDeveloper(
    @Query('developerId') developerId: string,
  ): Promise<WebhookSubscriptionEntity[]> {
    return this.listWebhookSubscriptionsUseCase.execute(developerId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionEntity> {
    return this.updateWebhookSubscriptionUseCase.execute(id, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteWebhookSubscriptionUseCase.execute(id);
  }
}
