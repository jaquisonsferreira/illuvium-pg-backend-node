import { Test, TestingModule } from '@nestjs/testing';
import { ManageLinkedAccountsUseCase } from './manage-linked-accounts.use-case';
import { LinkedAccountRepositoryInterface } from '../../domain/repositories/linked-account.repository.interface';
import { LinkedAccountEntity } from '../../domain/entities/linked-account.entity';
import { LINKED_ACCOUNT_REPOSITORY_TOKEN } from '../../constants';

describe('ManageLinkedAccountsUseCase', () => {
  let useCase: ManageLinkedAccountsUseCase;
  let linkedAccountRepository: jest.Mocked<LinkedAccountRepositoryInterface>;

  const mockLinkedAccount = new LinkedAccountEntity({
    owner: 'user123',
    type: 'wallet',
    identifier: '0x1234567890123456789012345678901234567890',
    emailAddress: undefined,
    label: 'My Wallet',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  });

  const mockEmailAccount = new LinkedAccountEntity({
    owner: 'user123',
    type: 'email',
    identifier: 'test@example.com',
    emailAddress: 'test@example.com',
    label: 'Primary Email',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  });

  beforeEach(async () => {
    const mockLinkedAccountRepository = {
      findByOwner: jest.fn(),
      findByTypeAndIdentifier: jest.fn(),
      findWalletsByOwner: jest.fn(),
      findEmailByOwner: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManageLinkedAccountsUseCase,
        {
          provide: LINKED_ACCOUNT_REPOSITORY_TOKEN,
          useValue: mockLinkedAccountRepository,
        },
      ],
    }).compile();

    useCase = module.get<ManageLinkedAccountsUseCase>(
      ManageLinkedAccountsUseCase,
    );
    linkedAccountRepository = module.get(LINKED_ACCOUNT_REPOSITORY_TOKEN);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('linkAccount', () => {
    const linkRequest = {
      userId: 'user123',
      type: 'wallet',
      identifier: '0x1234567890123456789012345678901234567890',
      label: 'My Wallet',
    };

    it('should successfully link a new account', async () => {
      linkedAccountRepository.findByTypeAndIdentifier.mockResolvedValue(null);
      linkedAccountRepository.save.mockResolvedValue(mockLinkedAccount);

      const result = await useCase.linkAccount(linkRequest);

      expect(result.success).toBe(true);
      expect(result.linkedAccount).toBe(mockLinkedAccount);
      expect(result.internalError).toBeUndefined();
      expect(
        linkedAccountRepository.findByTypeAndIdentifier,
      ).toHaveBeenCalledWith(
        'wallet',
        '0x1234567890123456789012345678901234567890',
      );
      expect(linkedAccountRepository.save).toHaveBeenCalledWith(
        expect.any(LinkedAccountEntity),
      );
    });

    it('should update existing account for same user', async () => {
      const existingAccount = new LinkedAccountEntity({
        owner: 'user123',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        emailAddress: undefined,
        label: 'My Wallet',
        createdAt: new Date('2022-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });

      linkedAccountRepository.findByTypeAndIdentifier.mockResolvedValue(
        existingAccount,
      );
      linkedAccountRepository.save.mockResolvedValue(mockLinkedAccount);

      const result = await useCase.linkAccount(linkRequest);

      expect(result.success).toBe(true);
      expect(result.linkedAccount).toBe(mockLinkedAccount);
      expect(linkedAccountRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'user123',
          type: 'wallet',
          identifier: '0x1234567890123456789012345678901234567890',
          createdAt: new Date('2022-01-01T00:00:00.000Z'),
        }),
      );
    });

    it('should fail when account is already linked to another user', async () => {
      const existingAccount = new LinkedAccountEntity({
        owner: 'different-user',
        type: 'wallet',
        identifier: '0x1234567890123456789012345678901234567890',
        emailAddress: undefined,
        label: 'My Wallet',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });

      linkedAccountRepository.findByTypeAndIdentifier.mockResolvedValue(
        existingAccount,
      );

      const result = await useCase.linkAccount(linkRequest);

      expect(result.success).toBe(false);
      expect(result.internalError).toBe(
        'Account already linked to another user',
      );
      expect(result.linkedAccount).toBeUndefined();
      expect(linkedAccountRepository.save).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      linkedAccountRepository.findByTypeAndIdentifier.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.linkAccount(linkRequest);

      expect(result.success).toBe(false);
      expect(result.internalError).toBe('Failed to link account');
      expect(result.linkedAccount).toBeUndefined();
    });
  });

  describe('unlinkAccount', () => {
    const unlinkRequest = {
      userId: 'user123',
      type: 'wallet',
      identifier: '0x1234567890123456789012345678901234567890',
    };

    it('should successfully unlink an account', async () => {
      linkedAccountRepository.delete.mockResolvedValue(undefined);

      const result = await useCase.unlinkAccount(unlinkRequest);

      expect(result.success).toBe(true);
      expect(result.internalError).toBeUndefined();
      expect(linkedAccountRepository.delete).toHaveBeenCalledWith(
        'user123',
        'wallet',
        '0x1234567890123456789012345678901234567890',
      );
    });

    it('should handle repository errors gracefully', async () => {
      linkedAccountRepository.delete.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.unlinkAccount(unlinkRequest);

      expect(result.success).toBe(false);
      expect(result.internalError).toBe('Failed to unlink account');
    });
  });

  describe('getLinkedAccounts', () => {
    const getRequest = {
      userId: 'user123',
    };

    it('should successfully get linked accounts', async () => {
      const linkedAccounts = [mockLinkedAccount, mockEmailAccount];
      linkedAccountRepository.findByOwner.mockResolvedValue(linkedAccounts);

      const result = await useCase.getLinkedAccounts(getRequest);

      expect(result.success).toBe(true);
      expect(result.linkedAccounts).toBe(linkedAccounts);
      expect(result.internalError).toBeUndefined();
      expect(linkedAccountRepository.findByOwner).toHaveBeenCalledWith(
        'user123',
      );
    });

    it('should handle repository errors gracefully', async () => {
      linkedAccountRepository.findByOwner.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.getLinkedAccounts(getRequest);

      expect(result.success).toBe(false);
      expect(result.internalError).toBe('Failed to get linked accounts');
      expect(result.linkedAccounts).toBeUndefined();
    });
  });

  describe('getWalletAccounts', () => {
    const getRequest = {
      userId: 'user123',
    };

    it('should successfully get wallet accounts', async () => {
      const walletAccounts = [mockLinkedAccount];
      linkedAccountRepository.findWalletsByOwner.mockResolvedValue(
        walletAccounts,
      );

      const result = await useCase.getWalletAccounts(getRequest);

      expect(result.success).toBe(true);
      expect(result.linkedAccounts).toBe(walletAccounts);
      expect(result.internalError).toBeUndefined();
      expect(linkedAccountRepository.findWalletsByOwner).toHaveBeenCalledWith(
        'user123',
      );
    });

    it('should handle repository errors gracefully', async () => {
      linkedAccountRepository.findWalletsByOwner.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.getWalletAccounts(getRequest);

      expect(result.success).toBe(false);
      expect(result.internalError).toBe('Failed to get wallet accounts');
      expect(result.linkedAccounts).toBeUndefined();
    });
  });

  describe('getEmailAccount', () => {
    const getRequest = {
      userId: 'user123',
    };

    it('should successfully get email account', async () => {
      linkedAccountRepository.findEmailByOwner.mockResolvedValue(
        mockEmailAccount,
      );

      const result = await useCase.getEmailAccount(getRequest);

      expect(result.success).toBe(true);
      expect(result.linkedAccount).toBe(mockEmailAccount);
      expect(result.internalError).toBeUndefined();
      expect(linkedAccountRepository.findEmailByOwner).toHaveBeenCalledWith(
        'user123',
      );
    });

    it('should return undefined when no email account exists', async () => {
      linkedAccountRepository.findEmailByOwner.mockResolvedValue(null);

      const result = await useCase.getEmailAccount(getRequest);

      expect(result.success).toBe(true);
      expect(result.linkedAccount).toBeUndefined();
      expect(result.internalError).toBeUndefined();
    });

    it('should handle repository errors gracefully', async () => {
      linkedAccountRepository.findEmailByOwner.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await useCase.getEmailAccount(getRequest);

      expect(result.success).toBe(false);
      expect(result.internalError).toBe('Failed to get email account');
      expect(result.linkedAccount).toBeUndefined();
    });
  });
});
