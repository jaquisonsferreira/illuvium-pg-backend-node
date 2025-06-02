import { LinkedAccountEntity } from '../entities/linked-account.entity';

export interface LinkedAccountRepositoryInterface {
  findByOwner(owner: string): Promise<LinkedAccountEntity[]>;
  findByTypeAndIdentifier(
    type: string,
    identifier: string,
  ): Promise<LinkedAccountEntity | null>;
  findWalletsByOwner(owner: string): Promise<LinkedAccountEntity[]>;
  findEmailByOwner(owner: string): Promise<LinkedAccountEntity | null>;
  save(linkedAccount: LinkedAccountEntity): Promise<LinkedAccountEntity>;
  delete(owner: string, type: string, identifier: string): Promise<void>;
  deleteAllByOwner(owner: string): Promise<void>;
}
