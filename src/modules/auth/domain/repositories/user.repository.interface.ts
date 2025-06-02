import { UserEntity } from '../entities/user.entity';

export interface UserRepositoryInterface {
  findByPrivyId(privyId: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<UserEntity>;
  create(
    userData: Omit<UserEntity['toJSON'], 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserEntity>;
}
