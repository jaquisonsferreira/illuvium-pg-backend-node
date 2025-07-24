import { SeasonEntity } from '../entities/season.entity';

export interface ISeasonRepository {
  findById(id: number): Promise<SeasonEntity | null>;

  findActive(): Promise<SeasonEntity | null>;

  findByChain(chain: string): Promise<SeasonEntity[]>;

  findActiveByChain(chain: string): Promise<SeasonEntity[]>;

  findByStatus(status: string): Promise<SeasonEntity[]>;

  findAll(): Promise<SeasonEntity[]>;

  create(entity: SeasonEntity): Promise<SeasonEntity>;

  update(entity: SeasonEntity): Promise<SeasonEntity>;

  findUpcoming(): Promise<SeasonEntity[]>;

  findCompleted(): Promise<SeasonEntity[]>;

  exists(id: number): Promise<boolean>;
}
