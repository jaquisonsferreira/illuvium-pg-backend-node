import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ProcessThirdwebWebhookUseCase } from '../../application/use-cases/process-thirdweb-webhook.use-case';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly processThirdwebWebhookUseCase: ProcessThirdwebWebhookUseCase,
  ) {}

  @Post('thirdweb')
  @HttpCode(HttpStatus.OK)
  async receiveThirdwebWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ): Promise<{ message: string; success: boolean }> {
    const startTime = Date.now();

    try {
      const rawBody = request.rawBody;
      if (!rawBody) {
        this.logger.error(
          'Raw body not available for webhook signature verification',
        );
        throw new BadRequestException(
          'Raw body required for webhook verification',
        );
      }

      const payload = rawBody.toString('utf8');

      this.logger.log('Received Thirdweb webhook', {
        contentLength: payload.length,
        userAgent: headers['user-agent'],
        contentType: headers['content-type'],
      });

      this.validateThirdwebWebhookHeaders(headers);

      const result = await this.processThirdwebWebhookUseCase.execute({
        payload,
        headers,
      });

      const processingTime = Date.now() - startTime;

      if (!result.success) {
        this.logger.error('Thirdweb webhook processing failed', {
          message: result.message,
          processingTimeMs: processingTime,
        });
        throw new InternalServerErrorException(result.message);
      }

      this.logger.log('Thirdweb webhook processed successfully', {
        eventType: result.eventType,
        userId: result.userId,
        processingTimeMs: processingTime,
      });

      return {
        message: result.message,
        success: true,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Error in Thirdweb webhook controller', {
        error: error.message,
        processingTimeMs: processingTime,
      });

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Internal server error processing Thirdweb webhook',
      );
    }
  }

  private validateThirdwebWebhookHeaders(
    headers: Record<string, string>,
  ): void {
    const requiredHeaders = [
      ['x-thirdweb-signature', 'x-signature'],
      ['x-thirdweb-timestamp', 'timestamp'],
    ];

    for (const headerOptions of requiredHeaders) {
      const hasAnyHeader = headerOptions.some((header) => headers[header]);
      if (!hasAnyHeader) {
        throw new BadRequestException(
          `Missing required Thirdweb webhook header. Expected one of: ${headerOptions.join(', ')}`,
        );
      }
    }
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ message: string; received: any }> {
    this.logger.log('Test webhook received', {
      headers: Object.keys(headers),
      bodyType: typeof body,
      bodyKeys: typeof body === 'object' ? Object.keys(body) : [],
    });

    return {
      message: 'Test webhook received successfully',
      received: {
        headers: headers,
        body: body,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
