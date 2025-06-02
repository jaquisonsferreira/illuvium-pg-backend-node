import { ThrottlerOptions } from '@nestjs/throttler';
import { EnvironmentConfigService } from './environment.config';
import { Request } from 'express';

/**
 * Creates rate limit configuration for the application
 * @param config Environment configuration service
 * @returns ThrottlerModule options
 */
export const createRateLimitConfig = (
  config: EnvironmentConfigService,
): ThrottlerOptions[] => {
  return [
    {
      name: 'default',
      ttl: config.getRateLimitTtl(),
      limit: config.getRateLimitMax(),
      skipIf: (context) => {
        const request = context.switchToHttp().getRequest<Request>();
        const apiKey = request.headers['x-api-key'] as string;
        return config.isTrustedApiKey(apiKey);
      },
    },
  ];
};
