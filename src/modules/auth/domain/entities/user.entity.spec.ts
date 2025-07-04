import { UserEntity, UserProps } from './user.entity';

describe('UserEntity', () => {
  const mockUserProps: UserProps = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    thirdwebId: 'tw_123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    isActive: true,
  };

  describe('constructor', () => {
    it('should create a user entity with all properties', () => {
      const user = new UserEntity(mockUserProps);

      expect(user.id).toBe(mockUserProps.id);

      expect(user.createdAt).toBe(mockUserProps.createdAt);
      expect(user.updatedAt).toBe(mockUserProps.updatedAt);
      expect(user.isActive).toBe(mockUserProps.isActive);
    });

    it('should create a user entity with minimal properties', () => {
      const minimalProps: UserProps = {
        id: '123e4567-e89b-12d3-a456-426614174000',

        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        isActive: true,
      };

      const user = new UserEntity(minimalProps);

      expect(user.id).toBe(minimalProps.id);

      expect(user.nickname).toBeUndefined();
      expect(user.avatarUrl).toBeUndefined();
      expect(user.createdAt).toBe(minimalProps.createdAt);
      expect(user.updatedAt).toBe(minimalProps.updatedAt);
      expect(user.isActive).toBe(minimalProps.isActive);
    });
  });

  describe('updateNickname', () => {
    it('should update nickname and return new instance', () => {
      const user = new UserEntity(mockUserProps);
      const newNickname = 'NewNickname';
      const beforeUpdate = new Date();

      const updatedUser = user.updateNickname(newNickname);
      const afterUpdate = new Date();

      expect(updatedUser).not.toBe(user);
      expect(updatedUser.nickname).toBe(newNickname);
      expect(updatedUser.id).toBe(user.id);

      expect(updatedUser.createdAt).toBe(user.createdAt);
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
