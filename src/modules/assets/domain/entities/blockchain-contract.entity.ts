import { randomUUID } from 'crypto';
import { ApiProperty } from '@nestjs/swagger';

export type ContractType = 'ERC20' | 'ERC721' | 'ERC1155';

export class BlockchainContract {
  @ApiProperty({ description: 'Unique identifier for the contract' })
  id: string;

  @ApiProperty({ description: 'Contract address on the blockchain' })
  address: string;

  @ApiProperty({
    description: 'Type of contract',
    enum: ['ERC20', 'ERC721', 'ERC1155'],
  })
  contractType: ContractType;

  @ApiProperty({ description: 'Name of the contract' })
  name: string;

  @ApiProperty({ description: 'Symbol of the contract' })
  symbol: string;

  @ApiProperty({ description: 'Decimals for ERC20 contracts', nullable: true })
  decimals?: number;

  @ApiProperty({ description: 'Network where the contract is deployed' })
  network: string;

  @ApiProperty({ description: 'Whether the contract is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Creation date of the contract record' })
  createdAt: Date;

  @ApiProperty({ description: 'Update date of the contract record' })
  updatedAt: Date;

  constructor(params: {
    id?: string;
    address: string;
    contractType: ContractType;
    name: string;
    symbol: string;
    decimals?: number;
    network?: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = params.id ?? randomUUID();
    this.address = params.address.toLowerCase();
    this.contractType = params.contractType;
    this.name = params.name;
    this.symbol = params.symbol;
    this.decimals = params.decimals;
    this.network = params.network ?? 'immutable-zkevm';
    this.isActive = params.isActive ?? true;
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
  }

  isERC20(): boolean {
    return this.contractType === 'ERC20';
  }

  isERC721(): boolean {
    return this.contractType === 'ERC721';
  }

  isERC1155(): boolean {
    return this.contractType === 'ERC1155';
  }

  isFungible(): boolean {
    return this.contractType === 'ERC20' || this.contractType === 'ERC1155';
  }

  isNonFungible(): boolean {
    return this.contractType === 'ERC721' || this.contractType === 'ERC1155';
  }
}
