import { LinkedAccountEntity } from './linked-account.entity';

describe('LinkedAccountEntity', () => {
  const mockProps = {
    owner: 'user123',
    type: 'wallet',
    identifier: '0x1234567890123456789012345678901234567890',
    emailAddress: 'test@example.com',
    label: 'My Wallet',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  let linkedAccount: LinkedAccountEntity;

  beforeEach(() => {
    linkedAccount = new LinkedAccountEntity(mockProps);
  });

  it('should create a linked account entity', () => {
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount).toBeInstanceOf(LinkedAccountEntity);
  });

  describe('getters', () => {
    it('should return correct owner', () => {
      expect(linkedAccount.owner).toBe('user123');
    });

    it('should return correct type', () => {
      expect(linkedAccount.type).toBe('wallet');
    });

    it('should return correct identifier', () => {
      expect(linkedAccount.identifier).toBe(
        '0x1234567890123456789012345678901234567890',
      );
    });

    it('should return correct email address', () => {
      expect(linkedAccount.emailAddress).toBe('test@example.com');
    });

    it('should return correct label', () => {
      expect(linkedAccount.label).toBe('My Wallet');
    });

    it('should return correct created at date', () => {
      expect(linkedAccount.createdAt).toEqual(
        new Date('2023-01-01T00:00:00.000Z'),
      );
    });

    it('should return correct updated at date', () => {
      expect(linkedAccount.updatedAt).toEqual(
        new Date('2023-01-01T00:00:00.000Z'),
      );
    });

    it('should handle undefined email address', () => {
      const propsWithoutEmail = {
        owner: 'user123',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        label: 'My Wallet',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };
      const account = new LinkedAccountEntity(propsWithoutEmail);

      expect(account.emailAddress).toBeUndefined();
    });

    it('should handle undefined label', () => {
      const propsWithoutLabel = {
        owner: 'user123',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        emailAddress: 'test@example.com',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };
      const account = new LinkedAccountEntity(propsWithoutLabel);

      expect(account.label).toBeUndefined();
    });
  });

  describe('updateEmailAddress', () => {
    it('should update email address and return new instance', () => {
      const newEmail = 'newemail@example.com';
      const updatedAccount = linkedAccount.updateEmailAddress(newEmail);

      expect(updatedAccount).toBeInstanceOf(LinkedAccountEntity);
      expect(updatedAccount).not.toBe(linkedAccount);
      expect(updatedAccount.emailAddress).toBe(newEmail);
      expect(updatedAccount.updatedAt).not.toEqual(linkedAccount.updatedAt);
      expect(updatedAccount.updatedAt.getTime()).toBeGreaterThan(
        linkedAccount.updatedAt.getTime(),
      );

      // Other properties should remain the same
      expect(updatedAccount.owner).toBe(linkedAccount.owner);
      expect(updatedAccount.type).toBe(linkedAccount.type);
      expect(updatedAccount.identifier).toBe(linkedAccount.identifier);
      expect(updatedAccount.label).toBe(linkedAccount.label);
      expect(updatedAccount.createdAt).toEqual(linkedAccount.createdAt);
    });
  });

  describe('updateLabel', () => {
    it('should update label and return new instance', () => {
      const newLabel = 'Updated Wallet Label';
      const updatedAccount = linkedAccount.updateLabel(newLabel);

      expect(updatedAccount).toBeInstanceOf(LinkedAccountEntity);
      expect(updatedAccount).not.toBe(linkedAccount);
      expect(updatedAccount.label).toBe(newLabel);
      expect(updatedAccount.updatedAt).not.toEqual(linkedAccount.updatedAt);
      expect(updatedAccount.updatedAt.getTime()).toBeGreaterThan(
        linkedAccount.updatedAt.getTime(),
      );

      expect(updatedAccount.owner).toBe(linkedAccount.owner);
      expect(updatedAccount.type).toBe(linkedAccount.type);
      expect(updatedAccount.identifier).toBe(linkedAccount.identifier);
      expect(updatedAccount.emailAddress).toBe(linkedAccount.emailAddress);
      expect(updatedAccount.createdAt).toEqual(linkedAccount.createdAt);
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation', () => {
      const jsonObject = linkedAccount.toJSON();

      expect(jsonObject).toEqual({
        owner: 'user123',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        emailAddress: 'test@example.com',
        label: 'My Wallet',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
    });

    it('should handle undefined optional fields', () => {
      const propsWithoutOptionals = {
        owner: 'user123',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      };
      const account = new LinkedAccountEntity(propsWithoutOptionals);
      const jsonObject = account.toJSON();

      expect(jsonObject).toEqual({
        owner: 'user123',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
    });
  });

  describe('static factory methods', () => {
    describe('createWalletAccount', () => {
      it('should create a wallet account', () => {
        const walletAccount = LinkedAccountEntity.createWalletAccount(
          'user123',
          '0x1234567890123456789012345678901234567890',
          'My Wallet',
        );

        expect(walletAccount.owner).toBe('user123');
        expect(walletAccount.type).toBe('wallet');
        expect(walletAccount.identifier).toBe(
          '0x1234567890123456789012345678901234567890',
        );
        expect(walletAccount.label).toBe('My Wallet');
        expect(walletAccount.createdAt).toBeInstanceOf(Date);
        expect(walletAccount.updatedAt).toBeInstanceOf(Date);
      });

      it('should create a wallet account without label', () => {
        const walletAccount = LinkedAccountEntity.createWalletAccount(
          'user123',
          '0x1234567890123456789012345678901234567890',
        );

        expect(walletAccount.label).toBeUndefined();
      });
    });

    describe('createEmailAccount', () => {
      it('should create an email account', () => {
        const emailAccount = LinkedAccountEntity.createEmailAccount(
          'user123',
          'test@example.com',
        );

        expect(emailAccount.owner).toBe('user123');
        expect(emailAccount.type).toBe('email');
        expect(emailAccount.identifier).toBe('test@example.com');
        expect(emailAccount.emailAddress).toBe('test@example.com');
        expect(emailAccount.createdAt).toBeInstanceOf(Date);
        expect(emailAccount.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('createDiscordAccount', () => {
      it('should create a discord account', () => {
        const discordAccount = LinkedAccountEntity.createDiscordAccount(
          'user123',
          'discord123',
          'My Discord',
        );

        expect(discordAccount.owner).toBe('user123');
        expect(discordAccount.type).toBe('discord');
        expect(discordAccount.identifier).toBe('discord123');
        expect(discordAccount.label).toBe('My Discord');
      });
    });

    describe('createGoogleAccount', () => {
      it('should create a google account', () => {
        const googleAccount = LinkedAccountEntity.createGoogleAccount(
          'user123',
          'google123',
          'test@gmail.com',
        );

        expect(googleAccount.owner).toBe('user123');
        expect(googleAccount.type).toBe('google');
        expect(googleAccount.identifier).toBe('google123');
        expect(googleAccount.emailAddress).toBe('test@gmail.com');
      });
    });

    describe('createPasskeyAccount', () => {
      it('should create a passkey account', () => {
        const passkeyAccount = LinkedAccountEntity.createPasskeyAccount(
          'user123',
          'passkey123',
        );

        expect(passkeyAccount.owner).toBe('user123');
        expect(passkeyAccount.type).toBe('passkey');
        expect(passkeyAccount.identifier).toBe('passkey123');
      });
    });
  });
});
