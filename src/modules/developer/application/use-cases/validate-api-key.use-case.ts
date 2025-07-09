import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { DEVELOPER_API_KEY_REPOSITORY } from '../../constants';
import { IDeveloperApiKeyRepository } from '../../domain/repositories/developer-api-key.repository.interface';
import { DeveloperApiKey } from '../../domain/entities/developer-api-key.entity';
import { ApiKeyPermission } from '../../constants';

export interface ValidateApiKeyRequest {
  apiKey: string;
  requiredPermission?: ApiKeyPermission;
}

@Injectable()
export class ValidateApiKeyUseCase {
  constructor(
    @Inject(DEVELOPER_API_KEY_REPOSITORY)
    private readonly apiKeyRepository: IDeveloperApiKeyRepository,
  ) {}

  async execute(request: ValidateApiKeyRequest): Promise<DeveloperApiKey> {
    const apiKey = await this.apiKeyRepository.findByKey(request.apiKey);

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKey.isActive()) {
      throw new UnauthorizedException('API key is not active');
    }

    if (apiKey.isExpired()) {
      throw new UnauthorizedException('API key has expired');
    }

    if (
      request.requiredPermission &&
      !apiKey.hasPermission(request.requiredPermission)
    ) {
      throw new UnauthorizedException(
        `API key does not have required permission: ${request.requiredPermission}`,
      );
    }

    await this.apiKeyRepository.updateLastUsed(apiKey.id);

    return apiKey;
  }
}
