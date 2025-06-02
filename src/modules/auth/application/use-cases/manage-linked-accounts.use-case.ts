import { Injectable, Inject } from '@nestjs/common';
import { LinkedAccountEntity } from '../../domain/entities/linked-account.entity';
import { LinkedAccountRepositoryInterface } from '../../domain/repositories/linked-account.repository.interface';
import { LINKED_ACCOUNT_REPOSITORY_TOKEN } from '../../constants';

export interface LinkAccountRequest {
  userId: string;
  type: string;
  identifier: string;
  emailAddress?: string;
  label?: string;
}

export interface UnlinkAccountRequest {
  userId: string;
  type: string;
  identifier: string;
}

export interface GetLinkedAccountsRequest {
  userId: string;
}

export interface ManageLinkedAccountsResponse {
  success: boolean;
  linkedAccounts?: LinkedAccountEntity[];
  linkedAccount?: LinkedAccountEntity;
  internalError?: string;
}

@Injectable()
export class ManageLinkedAccountsUseCase {
  constructor(
    @Inject(LINKED_ACCOUNT_REPOSITORY_TOKEN)
    private readonly linkedAccountRepository: LinkedAccountRepositoryInterface,
  ) {}

  async linkAccount(
    request: LinkAccountRequest,
  ): Promise<ManageLinkedAccountsResponse> {
    try {
      // Check if account is already linked to another user
      const existingAccount =
        await this.linkedAccountRepository.findByTypeAndIdentifier(
          request.type,
          request.identifier,
        );

      if (existingAccount && existingAccount.owner !== request.userId) {
        console.error('Account already linked to another user', {
          type: request.type,
          identifier: request.identifier,
          existingOwner: existingAccount.owner,
          requestedOwner: request.userId,
        });
        return {
          success: false,
          internalError: 'Account already linked to another user',
        };
      }

      // Create or update the linked account
      const linkedAccount = new LinkedAccountEntity({
        owner: request.userId,
        type: request.type,
        identifier: request.identifier,
        emailAddress: request.emailAddress,
        label: request.label,
        createdAt: existingAccount?.createdAt || new Date(),
        updatedAt: new Date(),
      });

      const savedAccount =
        await this.linkedAccountRepository.save(linkedAccount);

      return {
        success: true,
        linkedAccount: savedAccount,
      };
    } catch (error) {
      console.error('Error linking account:', error);
      return {
        success: false,
        internalError: 'Failed to link account',
      };
    }
  }

  async unlinkAccount(
    request: UnlinkAccountRequest,
  ): Promise<ManageLinkedAccountsResponse> {
    try {
      await this.linkedAccountRepository.delete(
        request.userId,
        request.type,
        request.identifier,
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error unlinking account:', error);
      return {
        success: false,
        internalError: 'Failed to unlink account',
      };
    }
  }

  async getLinkedAccounts(
    request: GetLinkedAccountsRequest,
  ): Promise<ManageLinkedAccountsResponse> {
    try {
      const linkedAccounts = await this.linkedAccountRepository.findByOwner(
        request.userId,
      );

      return {
        success: true,
        linkedAccounts,
      };
    } catch (error) {
      console.error('Error getting linked accounts:', error);
      return {
        success: false,
        internalError: 'Failed to get linked accounts',
      };
    }
  }

  async getWalletAccounts(
    request: GetLinkedAccountsRequest,
  ): Promise<ManageLinkedAccountsResponse> {
    try {
      const walletAccounts =
        await this.linkedAccountRepository.findWalletsByOwner(request.userId);

      return {
        success: true,
        linkedAccounts: walletAccounts,
      };
    } catch (error) {
      console.error('Error getting wallet accounts:', error);
      return {
        success: false,
        internalError: 'Failed to get wallet accounts',
      };
    }
  }

  async getEmailAccount(
    request: GetLinkedAccountsRequest,
  ): Promise<ManageLinkedAccountsResponse> {
    try {
      const emailAccount = await this.linkedAccountRepository.findEmailByOwner(
        request.userId,
      );

      return {
        success: true,
        linkedAccount: emailAccount || undefined,
      };
    } catch (error) {
      console.error('Error getting email account:', error);
      return {
        success: false,
        internalError: 'Failed to get email account',
      };
    }
  }
}
