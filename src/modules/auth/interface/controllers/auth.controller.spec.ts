import { AuthController } from './auth.controller';
import { UserEntity } from '../../domain/entities/user.entity';
import { ManageLinkedAccountsUseCase } from '../../application/use-cases/manage-linked-accounts.use-case';
import { LinkedAccountRepositoryInterface } from '../../domain/repositories/linked-account.repository.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let mockManageLinkedAccountsUseCase: ManageLinkedAccountsUseCase;
  let mockLinkedAccountRepository: jest.Mocked<LinkedAccountRepositoryInterface>;

  const mockUser = new UserEntity({
    id: '123e4567-e89b-12d3-a456-426614174000',
    privyId: 'privy123',
    nickname: 'testuser',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  });

  beforeEach(() => {
    mockLinkedAccountRepository = {
      findByOwner: jest.fn(),
      findByTypeAndIdentifier: jest.fn(),
      findWalletsByOwner: jest.fn(),
      findEmailByOwner: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      deleteAllByOwner: jest.fn(),
    } as jest.Mocked<LinkedAccountRepositoryInterface>;

    mockManageLinkedAccountsUseCase = new ManageLinkedAccountsUseCase(
      mockLinkedAccountRepository,
    );

    controller = new AuthController(mockManageLinkedAccountsUseCase);
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const result = await controller.getProfile(mockUser);

      expect(result).toEqual({
        id: mockUser.id,
        privyId: mockUser.privyId,
        nickname: mockUser.nickname,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should return profile with undefined optional fields', async () => {
      const userWithoutOptionalFields = new UserEntity({
        id: '123e4567-e89b-12d3-a456-426614174000',
        privyId: 'privy_123',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: true,
      });

      const result = await controller.getProfile(userWithoutOptionalFields);

      expect(result).toEqual({
        id: userWithoutOptionalFields.id,
        privyId: userWithoutOptionalFields.privyId,
        nickname: undefined,
        avatarUrl: undefined,
        socialBluesky: undefined,
        isActive: userWithoutOptionalFields.isActive,
        createdAt: userWithoutOptionalFields.createdAt,
        updatedAt: userWithoutOptionalFields.updatedAt,
      });
    });
  });

  describe('protectedRoute', () => {
    it('should return protected route response', async () => {
      const beforeCall = new Date();
      const result = await controller.protectedRoute(mockUser);
      const afterCall = new Date();

      expect(result.message).toBe('This is a protected route');
      expect(result.userId).toBe(mockUser.id);
      expect(new Date(result.timestamp).getTime()).toBeGreaterThanOrEqual(
        beforeCall.getTime(),
      );
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(
        afterCall.getTime(),
      );
    });

    it('should include correct user ID in response', async () => {
      const result = await controller.protectedRoute(mockUser);

      expect(result.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return ISO string timestamp', async () => {
      const result = await controller.protectedRoute(mockUser);

      expect(typeof result.timestamp).toBe('string');
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
