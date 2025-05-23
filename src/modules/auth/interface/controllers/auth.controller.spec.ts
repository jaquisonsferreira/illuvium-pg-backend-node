import { AuthController } from './auth.controller';
import { UserEntity } from '../../domain/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;

  const mockUser = new UserEntity({
    id: '123e4567-e89b-12d3-a456-426614174000',
    privyId: 'privy_123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    isActive: true,
  });

  beforeEach(() => {
    controller = new AuthController();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const result = await controller.getProfile(mockUser);

      expect(result).toEqual({
        id: mockUser.id,
        privyId: mockUser.privyId,
        walletAddress: mockUser.walletAddress,
        email: mockUser.email,
        phoneNumber: mockUser.phoneNumber,
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
        walletAddress: undefined,
        email: undefined,
        phoneNumber: undefined,
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
