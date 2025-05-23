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
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
