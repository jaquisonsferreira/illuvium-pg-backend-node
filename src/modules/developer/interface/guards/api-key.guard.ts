import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ValidateApiKeyUseCase } from '../../application/use-cases/validate-api-key.use-case';
import { ApiKeyPermission } from '../../constants';

export const API_KEY_PERMISSION = 'API_KEY_PERMISSION';
export const SetApiKeyPermission =
  (permission: ApiKeyPermission) =>
  (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(API_KEY_PERMISSION, permission, descriptor.value);
  };

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly validateApiKeyUseCase: ValidateApiKeyUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKeyFromRequest(request);

    if (!apiKey) {
      return false;
    }

    const requiredPermission = this.reflector.get<ApiKeyPermission>(
      API_KEY_PERMISSION,
      context.getHandler(),
    );

    try {
      const validatedApiKey = await this.validateApiKeyUseCase.execute({
        apiKey,
        requiredPermission,
      });

      request.apiKey = validatedApiKey;
      return true;
    } catch {
      return false;
    }
  }

  private extractApiKeyFromRequest(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return authHeader;
  }
}
