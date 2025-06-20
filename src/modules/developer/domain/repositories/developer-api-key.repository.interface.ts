import { DeveloperApiKey } from '../entities/developer-api-key.entity';
import { ApiKeyPermission, ApiKeyStatus } from '../../constants';

export interface CreateApiKeyData {
  name: string;
  permissions: ApiKeyPermission[];
  userId: string;
  expiresAt?: Date;
}

export interface UpdateApiKeyData {
  name?: string;
  permissions?: ApiKeyPermission[];
  status?: ApiKeyStatus;
  expiresAt?: Date;
}

export interface IDeveloperApiKeyRepository {
  create(data: CreateApiKeyData): Promise<DeveloperApiKey>;
  findById(id: string): Promise<DeveloperApiKey | null>;
  findByKey(key: string): Promise<DeveloperApiKey | null>;
  findByUserId(userId: string): Promise<DeveloperApiKey[]>;
  update(id: string, data: UpdateApiKeyData): Promise<DeveloperApiKey>;
  delete(id: string): Promise<void>;
  updateLastUsed(id: string): Promise<void>;
}
