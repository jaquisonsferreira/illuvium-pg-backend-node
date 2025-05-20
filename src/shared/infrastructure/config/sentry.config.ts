import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { EnvironmentConfigService } from './environment.config';

export function setupSentry(configService: EnvironmentConfigService): void {
  Sentry.init({
    dsn: configService.getSentryDsn(),
    environment: configService.getNodeEnv(),
    enabled: configService.isSentryEnabled(),
    tracesSampleRate: configService.getSentryTracesSampleRate(),
    profilesSampleRate: configService.getSentryProfilesSampleRate(),
    integrations: [nodeProfilingIntegration()],
    // Performance monitoring
    tracePropagationTargets: configService.getSentryTracePropagationTargets(),
  });
}
