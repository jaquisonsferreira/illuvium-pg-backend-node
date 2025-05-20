import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { EnvironmentConfigService } from './environment.config';

/**
 * CORS configuration factory
 * Provides a configurable CORS setup for the application
 */
export const createCorsConfig = (
  environmentConfigService: EnvironmentConfigService,
  options?: Partial<CorsOptions>,
): CorsOptions => {
  // Default CORS configuration
  const defaultConfig: CorsOptions = {
    origin: environmentConfigService.getCorsAllowedOrigins(),
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Api-Key',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Pagination-Pages'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400, // 24 hours
  };

  return {
    ...defaultConfig,
    ...options,
  };
};
