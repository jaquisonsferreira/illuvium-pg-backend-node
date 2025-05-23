import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ValidateTokenUseCase } from '../../application/use-cases/validate-token.use-case';

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(private readonly validateTokenUseCase: ValidateTokenUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    const appId = process.env.PRIVY_APP_ID;
    if (!appId) {
      throw new UnauthorizedException('Authentication service not configured');
    }

    const validationResult = await this.validateTokenUseCase.execute({
      token,
      appId,
    });

    if (!validationResult.isValid) {
      throw new UnauthorizedException(
        validationResult.error || 'Invalid token',
      );
    }

    request.user = validationResult.user;

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const parts = authHeader.split(/\s+/); // Split on one or more whitespace characters
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return undefined;
    }

    return parts[1];
  }
}
