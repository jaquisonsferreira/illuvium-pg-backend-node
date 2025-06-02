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
    const result = await sql`
      UPDATE users
      SET
        nickname = ${user.nickname || null},
        avatar_url = ${user.avatarUrl || null},
        experiments = ${user.experiments ? JSON.stringify(user.experiments) : null},
        social_bluesky = ${user.socialBluesky || null},
        social_discord = ${user.socialDiscord || null},
        social_instagram = ${user.socialInstagram || null},
        social_farcaster = ${user.socialFarcaster || null},
        social_twitch = ${user.socialTwitch || null},
        social_youtube = ${user.socialYoutube || null},
        social_x = ${user.socialX || null},
        is_active = ${user.isActive},
        updated_at = ${new Date()}
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
    const result = await sql`
      INSERT INTO users (
        id, privy_id, nickname, avatar_url, experiments,
        social_bluesky, social_discord, social_instagram,
        social_farcaster, social_twitch, social_youtube, social_x,
        is_active, created_at, updated_at
      )
      VALUES (
        ${uuidv4()}, ${userData.privyId}, ${userData.nickname || null},
        ${userData.avatarUrl || null}, ${userData.experiments ? JSON.stringify(userData.experiments) : null},
        ${userData.socialBluesky || null}, ${userData.socialDiscord || null},
        ${userData.socialInstagram || null}, ${userData.socialFarcaster || null},
        ${userData.socialTwitch || null}, ${userData.socialYoutube || null},
        ${userData.socialX || null}, ${userData.isActive}, ${new Date()}, ${new Date()}
      )
      RETURNING *
    `.execute(this.db);

    const dbUser = result.rows[0] as DbUser;
    return this.toDomainEntity(dbUser);
  }

  private toDomainEntity(dbUser: DbUser): UserEntity {
    const userProps: UserProps = {
      id: dbUser.id,
      privyId: dbUser.privy_id,
      nickname: dbUser.nickname || undefined,
      avatarUrl: dbUser.avatar_url || undefined,
      experiments: dbUser.experiments
        ? JSON.parse(dbUser.experiments)
        : undefined,
      socialBluesky: dbUser.social_bluesky || undefined,
      socialDiscord: dbUser.social_discord || undefined,
      socialInstagram: dbUser.social_instagram || undefined,
      socialFarcaster: dbUser.social_farcaster || undefined,
      socialTwitch: dbUser.social_twitch || undefined,
      socialYoutube: dbUser.social_youtube || undefined,
      socialX: dbUser.social_x || undefined,
      isActive: dbUser.is_active,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
    };

    return new UserEntity(userProps);
  }
}
