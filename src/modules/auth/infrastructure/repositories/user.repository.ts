import { Inject, Injectable } from '@nestjs/common';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { UserEntity, UserProps } from '../../domain/entities/user.entity';
import {
  User as DbUser,
  Database,
  NewUser,
  UserUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';
import { sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserRepository implements UserRepositoryInterface {
  private repository: BaseRepository<'users', DbUser, NewUser, UserUpdate>;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'users',
      DbUser,
      NewUser,
      UserUpdate
    >('users');
  }

  async findByPrivyId(privyId: string): Promise<UserEntity | null> {
    const result = await sql`
      SELECT * FROM users
      WHERE privy_id = ${privyId}
      LIMIT 1
    `.execute(this.db);

    if (result.rows.length === 0) {
      return null;
    }

    const dbUser = result.rows[0] as DbUser;
    return this.toDomainEntity(dbUser);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const dbUser = await this.repository.findById(id);

    if (!dbUser) {
      return null;
    }

    return this.toDomainEntity(dbUser);
  }

  async save(user: UserEntity): Promise<UserEntity> {
    const updateData: UserUpdate = {
      wallet_address: user.walletAddress,
      email: user.email,
      phone_number: user.phoneNumber,
      is_active: user.isActive,
      updated_at: new Date(),
    };

    const result = await sql`
      UPDATE users
      SET
        wallet_address = ${updateData.wallet_address},
        email = ${updateData.email},
        phone_number = ${updateData.phone_number},
        is_active = ${updateData.is_active},
        updated_at = ${updateData.updated_at}
      WHERE id = ${user.id}
      RETURNING *
    `.execute(this.db);

    if (result.rows.length === 0) {
      throw new Error('User not found for update');
    }

    const updatedDbUser = result.rows[0] as DbUser;
    return this.toDomainEntity(updatedDbUser);
  }

  async create(
    userData: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserEntity> {
    const newUser: NewUser = {
      id: uuidv4(),
      privy_id: userData.privyId,
      wallet_address: userData.walletAddress || null,
      email: userData.email || null,
      phone_number: userData.phoneNumber || null,
      is_active: userData.isActive,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const dbUser = await this.repository.create(newUser);
    return this.toDomainEntity(dbUser);
  }

  private toDomainEntity(dbUser: DbUser): UserEntity {
    const userProps: UserProps = {
      id: dbUser.id,
      privyId: dbUser.privy_id,
      walletAddress: dbUser.wallet_address || undefined,
      email: dbUser.email || undefined,
      phoneNumber: dbUser.phone_number || undefined,
      isActive: dbUser.is_active,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
    };

    return new UserEntity(userProps);
  }
}
