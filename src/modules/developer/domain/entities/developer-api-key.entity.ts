import { ApiKeyPermission, ApiKeyStatus } from '../../constants';

export class DeveloperApiKey {
  constructor(
    public readonly id: string,
    public readonly key: string,
    public readonly name: string,
    public readonly permissions: ApiKeyPermission[],
    public readonly status: ApiKeyStatus,
    public readonly userId: string,
    public readonly expiresAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly lastUsedAt: Date | null = null,
  ) {}

  hasPermission(permission: ApiKeyPermission): boolean {
    return this.permissions.includes(permission);
  }

  isActive(): boolean {
    return this.status === ApiKeyStatus.ACTIVE;
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  canPerformAction(permission: ApiKeyPermission): boolean {
    return (
      this.isActive() && !this.isExpired() && this.hasPermission(permission)
    );
  }
}
