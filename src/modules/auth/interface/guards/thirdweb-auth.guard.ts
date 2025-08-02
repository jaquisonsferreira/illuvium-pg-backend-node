import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ValidateTokenUseCase } from '../../application/use-cases/validate-token.use-case';

const getThirdwebClientId = (): string => {
  const secretsPath = '/mnt/secrets';
  const clientIdPath = join(secretsPath, 'thirdweb-client-id');

  if (existsSync(clientIdPath)) {
    return readFileSync(clientIdPath, 'utf8').trim();
  }

  return process.env.THIRDWEB_CLIENT_ID || '';
};

@Injectable()
export class ThirdwebAuthGuard implements CanActivate {
  constructor(private readonly validateTokenUseCase: ValidateTokenUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    const clientId = getThirdwebClientId();
    if (!clientId) {
      throw new UnauthorizedException('Authentication service not configured');
    }

    const validationResult = await this.validateTokenUseCase.execute({
      token,
      clientId,
    });

    if (!validationResult.isValid) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = validationResult.user;

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const parts = authHeader.split(/\s+/);
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return undefined;
    }

    return parts[1];
  }
}
