import {
  BlockchainContract,
  ContractType,
} from '../entities/blockchain-contract.entity';

export interface BlockchainContractRepositoryInterface {
  create(contract: BlockchainContract): Promise<BlockchainContract>;
  findById(id: string): Promise<BlockchainContract | null>;
  findByAddress(address: string): Promise<BlockchainContract | null>;
  findByType(contractType: ContractType): Promise<BlockchainContract[]>;
  findActive(): Promise<BlockchainContract[]>;
  findAll(): Promise<BlockchainContract[]>;
  update(
    id: string,
    contract: Partial<BlockchainContract>,
  ): Promise<BlockchainContract | null>;
  delete(id: string): Promise<boolean>;

  // Specific methods for blockchain contracts
  findByAddresses(addresses: string[]): Promise<BlockchainContract[]>;
  markAsInactive(id: string): Promise<boolean>;
  findBySymbol(symbol: string): Promise<BlockchainContract[]>;
}
