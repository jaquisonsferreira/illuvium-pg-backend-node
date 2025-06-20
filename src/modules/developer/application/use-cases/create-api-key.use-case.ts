import { Injectable, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DEVELOPER_API_KEY_REPOSITORY } from '../../constants';
import {
  IDeveloperApiKeyRepository,
  CreateApiKeyData,
} from '../../domain/repositories/developer-api-key.repository.interface';
import { DeveloperApiKey } from '../../domain/entities/developer-api-key.entity';

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  userId: string;
  expiresAt?: Date;
}

@Injectable()
export class CreateApiKeyUseCase {
  constructor(
    @Inject(DEVELOPER_API_KEY_REPOSITORY)
    private readonly apiKeyRepository: IDeveloperApiKeyRepository,
  ) {}

  async execute(request: CreateApiKeyRequest): Promise<DeveloperApiKey> {
    const createData: CreateApiKeyData = {
      name: request.name,
      permissions: request.permissions as any[],
      userId: request.userId,
      expiresAt: request.expiresAt,
    };

    return await this.apiKeyRepository.create(createData);
  }

  private generateApiKey(): string {
    return 'dev_' + randomBytes(32).toString('hex');
  }
}
