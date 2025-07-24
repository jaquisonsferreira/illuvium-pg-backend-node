import { VaultPositionEntity } from '../entities/vault-position.entity';

export interface IVaultPositionRepository {
  findById(id: string): Promise<VaultPositionEntity | null>;

  findByWalletAndDate(
    walletAddress: string,
    snapshotDate: Date,
  ): Promise<VaultPositionEntity[]>;

  findByWalletAndSeason(
    walletAddress: string,
    seasonId: number,
  ): Promise<VaultPositionEntity[]>;

  findByWalletVaultAndSeason(
    walletAddress: string,
    vaultAddress: string,
    seasonId: number,
  ): Promise<VaultPositionEntity | null>;

  findByVaultAndDate(
    vaultAddress: string,
    snapshotDate: Date,
  ): Promise<VaultPositionEntity[]>;

  findLatestByWallet(
    walletAddress: string,
    chain?: string,
  ): Promise<VaultPositionEntity[]>;

  findActiveBySeason(seasonId: number): Promise<VaultPositionEntity[]>;

  findStalePositions(
    maxAge: Date,
    chain?: string,
  ): Promise<VaultPositionEntity[]>;

  create(entity: VaultPositionEntity): Promise<VaultPositionEntity>;

  createBatch(entities: VaultPositionEntity[]): Promise<void>;

  upsert(entity: VaultPositionEntity): Promise<VaultPositionEntity>;

  update(entity: VaultPositionEntity): Promise<VaultPositionEntity>;

  delete(id: string): Promise<void>;

  deleteByDateAndChain(snapshotDate: Date, chain: string): Promise<number>;

  getTotalValueLocked(
    chain: string,
    snapshotDate: Date,
  ): Promise<{
    totalUsdValue: number;
    byAsset: Record<string, number>;
  }>;

  getUniqueWalletCount(chain: string, snapshotDate: Date): Promise<number>;

  getTopPositionsByValue(
    chain: string,
    snapshotDate: Date,
    limit: number,
  ): Promise<VaultPositionEntity[]>;
}
