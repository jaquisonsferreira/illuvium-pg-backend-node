import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

interface ThrottlerLimitDetail {
  limit: number;
  ttl: number;
  totalHits: number;
  timeToExpire: number;
  tracker: string;
  key: string;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ApiThrottlerGuard.name);

  protected override getTracker(req: Record<string, any>): Promise<string> {
    // Get the IP address from the request
    let ipAddress: string;

    // Handle if the app is behind a proxy
    if (req.ips?.length) {
      ipAddress = req.ips[0];
    } else {
      ipAddress = req.ip;
    }

    // Log information about the incoming request
    this.logger.debug(
      `Request from IP: ${ipAddress}, path: ${req.path}, method: ${req.method}`,
    );

    return Promise.resolve(ipAddress);
  }

  protected override throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { limit, totalHits, timeToExpire, tracker } = throttlerLimitDetail;

    this.logger.warn(
      `Rate limit exceeded for ${tracker}: ${totalHits}/${limit} requests. ` +
        `Retry after ${Math.ceil(timeToExpire / 1000)} seconds.`,
    );

    // Get the original request
    const req = context.switchToHttp().getRequest();
    const path = req.path || 'unknown';
    const method = req.method || 'unknown';

    // Throw a detailed exception
    throw new ThrottlerException(
      `Rate limit exceeded: ${totalHits}/${limit} requests for ${path} [${method}]. ` +
        `Please try again after ${Math.ceil(timeToExpire / 1000)} seconds.`,
    );
  }
}
