import { UserEntity, UserProps } from './user.entity';

describe('UserEntity', () => {
  const mockUserProps: UserProps = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    privyId: 'privy_123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    isActive: true,
  };

  describe('constructor', () => {
    it('should create a user entity with all properties', () => {
      const user = new UserEntity(mockUserProps);

      expect(user.id).toBe(mockUserProps.id);
      expect(user.privyId).toBe(mockUserProps.privyId);
      expect(user.walletAddress).toBe(mockUserProps.walletAddress);
      expect(user.email).toBe(mockUserProps.email);
      expect(user.phoneNumber).toBe(mockUserProps.phoneNumber);
      expect(user.createdAt).toBe(mockUserProps.createdAt);
      expect(user.updatedAt).toBe(mockUserProps.updatedAt);
      expect(user.isActive).toBe(mockUserProps.isActive);
    });

    it('should create a user entity with minimal properties', () => {
      const minimalProps: UserProps = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        privyId: 'privy_123',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: true,
      };

      const user = new UserEntity(minimalProps);

      expect(user.id).toBe(minimalProps.id);
      expect(user.privyId).toBe(minimalProps.privyId);
      expect(user.walletAddress).toBeUndefined();
      expect(user.email).toBeUndefined();
      expect(user.phoneNumber).toBeUndefined();
      expect(user.createdAt).toBe(minimalProps.createdAt);
      expect(user.updatedAt).toBe(minimalProps.updatedAt);
      expect(user.isActive).toBe(minimalProps.isActive);
    });
  });

  describe('updateWalletAddress', () => {
    it('should return a new user entity with updated wallet address', () => {
      const user = new UserEntity(mockUserProps);
      const newWalletAddress = '0x9876543210987654321098765432109876543210';

      const beforeUpdate = new Date();
      const updatedUser = user.updateWalletAddress(newWalletAddress);
      const afterUpdate = new Date();

      expect(updatedUser).not.toBe(user);
      expect(updatedUser.walletAddress).toBe(newWalletAddress);
      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.privyId).toBe(user.privyId);
      expect(updatedUser.email).toBe(user.email);
      expect(updatedUser.phoneNumber).toBe(user.phoneNumber);
      expect(updatedUser.createdAt).toBe(user.createdAt);
      expect(updatedUser.isActive).toBe(user.isActive);
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
      expect(updatedUser.updatedAt.getTime()).toBeLessThanOrEqual(
        afterUpdate.getTime(),
      );
    });
  });

  describe('deactivate', () => {
    it('should return a new user entity with isActive set to false', () => {
      const user = new UserEntity(mockUserProps);

      const beforeUpdate = new Date();
      const deactivatedUser = user.deactivate();
      const afterUpdate = new Date();

      expect(deactivatedUser).not.toBe(user);
      expect(deactivatedUser.isActive).toBe(false);
      expect(deactivatedUser.id).toBe(user.id);
      expect(deactivatedUser.privyId).toBe(user.privyId);
      expect(deactivatedUser.walletAddress).toBe(user.walletAddress);
      expect(deactivatedUser.email).toBe(user.email);
      expect(deactivatedUser.phoneNumber).toBe(user.phoneNumber);
      expect(deactivatedUser.createdAt).toBe(user.createdAt);
      expect(deactivatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
      expect(deactivatedUser.updatedAt.getTime()).toBeLessThanOrEqual(
        afterUpdate.getTime(),
      );
    });
  });

  describe('activate', () => {
    it('should return a new user entity with isActive set to true', () => {
      const inactiveUserProps = { ...mockUserProps, isActive: false };
      const user = new UserEntity(inactiveUserProps);

      const beforeUpdate = new Date();
      const activatedUser = user.activate();
      const afterUpdate = new Date();

      expect(activatedUser).not.toBe(user);
      expect(activatedUser.isActive).toBe(true);
      expect(activatedUser.id).toBe(user.id);
      expect(activatedUser.privyId).toBe(user.privyId);
      expect(activatedUser.walletAddress).toBe(user.walletAddress);
      expect(activatedUser.email).toBe(user.email);
      expect(activatedUser.phoneNumber).toBe(user.phoneNumber);
      expect(activatedUser.createdAt).toBe(user.createdAt);
      expect(activatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
      expect(activatedUser.updatedAt.getTime()).toBeLessThanOrEqual(
        afterUpdate.getTime(),
      );
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with all user properties', () => {
      const user = new UserEntity(mockUserProps);
      const json = user.toJSON();

      expect(json).toEqual(mockUserProps);
      expect(json).not.toBe(mockUserProps); // Should be a copy
    });
  });
});
