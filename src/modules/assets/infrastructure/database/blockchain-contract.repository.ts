import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { BlockchainContractRepositoryInterface } from '../../domain/repositories/blockchain-contract.repository.interface';
import {
  BlockchainContract,
  ContractType,
} from '../../domain/entities/blockchain-contract.entity';
import {
  BlockchainContract as DbContract,
  Database,
  NewBlockchainContract,
  BlockchainContractUpdate,
  RepositoryFactory,
  BaseRepository,
  DATABASE_CONNECTION,
  Kysely,
} from '@shared/infrastructure/database';

@Injectable()
export class BlockchainContractRepository
  implements BlockchainContractRepositoryInterface
{
  private repository: BaseRepository<
    'blockchain_contracts',
    DbContract,
    NewBlockchainContract,
    BlockchainContractUpdate
  >;

  constructor(
    private readonly repositoryFactory: RepositoryFactory,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Kysely<Database>,
  ) {
    this.repository = this.repositoryFactory.createRepository<
      'blockchain_contracts',
      DbContract,
      NewBlockchainContract,
      BlockchainContractUpdate
    >('blockchain_contracts');
  }

  private toDatabaseModel = (
    contract: BlockchainContract,
  ): NewBlockchainContract => {
    return {
      address: contract.address.toLowerCase(),
      contract_type: contract.contractType,
      name: contract.name,
      symbol: contract.symbol,
      decimals: contract.decimals || null,
      network: contract.network,
      is_active: contract.isActive,
      ...(contract.id && { id: contract.id }),
    };
  };

  private toDomainModel = (dbContract: DbContract): BlockchainContract => {
    return new BlockchainContract({
      id: dbContract.id,
      address: dbContract.address,
      contractType: dbContract.contract_type as ContractType,
      name: dbContract.name,
      symbol: dbContract.symbol,
      decimals: dbContract.decimals || undefined,
      network: dbContract.network,
      isActive: dbContract.is_active,
      createdAt: dbContract.created_at,
      updatedAt: dbContract.updated_at,
    });
  };

  async create(contract: BlockchainContract): Promise<BlockchainContract> {
    try {
      const dbContract = await this.repository.create(
        this.toDatabaseModel(contract),
      );
      return this.toDomainModel(dbContract);
    } catch (error) {
      console.error('Error creating blockchain contract:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<BlockchainContract | null> {
    try {
      const dbContract = await this.repository.findById(id);
      return dbContract ? this.toDomainModel(dbContract) : null;
    } catch (error) {
      console.error(`Error finding contract by ID: ${id}`, error);
      throw error;
    }
  }

  async findByAddress(address: string): Promise<BlockchainContract | null> {
    try {
      const result = await sql`
        SELECT * FROM blockchain_contracts
        WHERE address = ${address.toLowerCase()}
        LIMIT 1
      `.execute(this.db);

      if (result.rows.length === 0) {
        return null;
      }

      return this.toDomainModel(result.rows[0] as DbContract);
    } catch (error) {
      console.error(`Error finding contract by address: ${address}`, error);
      throw error;
    }
  }

  async findByType(contractType: ContractType): Promise<BlockchainContract[]> {
    try {
      const result = await sql`
        SELECT * FROM blockchain_contracts
        WHERE contract_type = ${contractType}
        ORDER BY created_at DESC
      `.execute(this.db);

      return result.rows.map((row) => this.toDomainModel(row as DbContract));
    } catch (error) {
      console.error(`Error finding contracts by type: ${contractType}`, error);
      throw error;
    }
  }

  async findActive(): Promise<BlockchainContract[]> {
    try {
      const result = await sql`
        SELECT * FROM blockchain_contracts
        WHERE is_active = true
        ORDER BY created_at DESC
      `.execute(this.db);

      return result.rows.map((row) => this.toDomainModel(row as DbContract));
    } catch (error) {
      console.error('Error finding active contracts:', error);
      throw error;
    }
  }

  async findAll(): Promise<BlockchainContract[]> {
    try {
      const dbContracts = await this.repository.findAll();
      return dbContracts.map(this.toDomainModel);
    } catch (error) {
      console.error('Error finding all contracts:', error);
      throw error;
    }
  }

  async update(
    id: string,
    contract: Partial<BlockchainContract>,
  ): Promise<BlockchainContract | null> {
    try {
      const updateData: BlockchainContractUpdate = {};

      if (contract.address !== undefined)
        updateData.address = contract.address.toLowerCase();
      if (contract.contractType !== undefined)
        updateData.contract_type = contract.contractType;
      if (contract.name !== undefined) updateData.name = contract.name;
      if (contract.symbol !== undefined) updateData.symbol = contract.symbol;
      if (contract.decimals !== undefined)
        updateData.decimals = contract.decimals || null;
      if (contract.network !== undefined) updateData.network = contract.network;
      if (contract.isActive !== undefined)
        updateData.is_active = contract.isActive;

      const dbContract = await this.repository.update(id, updateData);
      return dbContract ? this.toDomainModel(dbContract) : null;
    } catch (error) {
      console.error(`Error updating contract: ${id}`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      return await this.repository.delete(id);
    } catch (error) {
      console.error(`Error deleting contract: ${id}`, error);
      throw error;
    }
  }

  // Specific methods for blockchain contracts
  async findByAddresses(addresses: string[]): Promise<BlockchainContract[]> {
    try {
      const normalizedAddresses = addresses.map((addr) => addr.toLowerCase());

      const result = await sql`
        SELECT * FROM blockchain_contracts
        WHERE address = ANY(${JSON.stringify(normalizedAddresses)})
        ORDER BY created_at DESC
      `.execute(this.db);

      return result.rows.map((row) => this.toDomainModel(row as DbContract));
    } catch (error) {
      console.error(
        `Error finding contracts by addresses: ${addresses.join(', ')}`,
        error,
      );
      throw error;
    }
  }

  async markAsInactive(id: string): Promise<boolean> {
    try {
      const result = await sql`
        UPDATE blockchain_contracts
        SET is_active = false, updated_at = NOW()
        WHERE id = ${id}
      `.execute(this.db);

      return (result.numAffectedRows ?? 0) > 0;
    } catch (error) {
      console.error(`Error marking contract as inactive: ${id}`, error);
      throw error;
    }
  }

  async findBySymbol(symbol: string): Promise<BlockchainContract[]> {
    try {
      const result = await sql`
        SELECT * FROM blockchain_contracts
        WHERE symbol ILIKE ${`%${symbol}%`}
        ORDER BY created_at DESC
      `.execute(this.db);

      return result.rows.map((row) => this.toDomainModel(row as DbContract));
    } catch (error) {
      console.error(`Error finding contracts by symbol: ${symbol}`, error);
      throw error;
    }
  }
}
