import { UserEntity } from '../entities/user.entity';

export interface UserRepositoryInterface {
  findByThirdwebId(thirdwebId: string): Promise<UserEntity | null>;
  findByWalletAddress(walletAddress: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<UserEntity>;
  create(
    userData: Omit<UserEntity['toJSON'], 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserEntity>;
}
