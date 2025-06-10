import { randomUUID } from 'crypto';
import { ApiProperty } from '@nestjs/swagger';
import { BlockchainAsset } from './blockchain-asset.entity';
import { BlockchainContract } from './blockchain-contract.entity';

export type ListingType = 'SALE' | 'BID';
export type ListingStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export class AssetMarketplace {
  @ApiProperty({ description: 'Unique identifier for the marketplace listing' })
  id: string;

  @ApiProperty({ description: 'Asset ID reference' })
  assetId: string;

  @ApiProperty({
    description: 'Type of listing',
    enum: ['SALE', 'BID'],
  })
  listingType: ListingType;

  @ApiProperty({ description: 'Price as string for precision' })
  price: string;

  @ApiProperty({
    description: 'Currency contract ID (for payment token)',
    nullable: true,
  })
  currencyContract?: string;

  @ApiProperty({ description: 'Seller address' })
  sellerAddress: string;

  @ApiProperty({ description: 'Buyer address (for bids)', nullable: true })
  buyerAddress?: string;

  @ApiProperty({
    description: 'Listing status',
    enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
  })
  status: ListingStatus;

  @ApiProperty({ description: 'Expiration timestamp', nullable: true })
  expiresAt?: Date;

  @ApiProperty({ description: 'Creation date of the listing' })
  createdAt: Date;

  @ApiProperty({ description: 'Update date of the listing' })
  updatedAt: Date;

  // Optional populated data
  asset?: BlockchainAsset;
  currency?: BlockchainContract;

  constructor(params: {
    id?: string;
    assetId: string;
    listingType: ListingType;
    price: string;
    currencyContract?: string;
    sellerAddress: string;
    buyerAddress?: string;
    status?: ListingStatus;
    expiresAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    asset?: BlockchainAsset;
    currency?: BlockchainContract;
  }) {
    this.id = params.id ?? randomUUID();
    this.assetId = params.assetId;
    this.listingType = params.listingType;
    this.price = params.price;
    this.currencyContract = params.currencyContract;
    this.sellerAddress = params.sellerAddress.toLowerCase();
    this.buyerAddress = params.buyerAddress?.toLowerCase();
    this.status = params.status ?? 'ACTIVE';
    this.expiresAt = params.expiresAt;
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
    this.asset = params.asset;
    this.currency = params.currency;
  }

  isSale(): boolean {
    return this.listingType === 'SALE';
  }

  isBid(): boolean {
    return this.listingType === 'BID';
  }

  isActive(): boolean {
    return this.status === 'ACTIVE' && !this.isExpired();
  }

  isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  isCompleted(): boolean {
    return this.status === 'COMPLETED';
  }

  isCancelled(): boolean {
    return this.status === 'CANCELLED';
  }

  canBeAcceptedBy(address: string): boolean {
    const normalizedAddress = address.toLowerCase();

    if (!this.isActive()) {
      return false;
    }

    if (this.isSale()) {
      // For sales, anyone except the seller can buy
      return normalizedAddress !== this.sellerAddress;
    }

    if (this.isBid()) {
      // For bids, only the current owner (seller) can accept
      return normalizedAddress === this.sellerAddress;
    }

    return false;
  }

  canBeModifiedBy(address: string): boolean {
    const normalizedAddress = address.toLowerCase();

    if (this.isSale()) {
      return normalizedAddress === this.sellerAddress;
    }

    if (this.isBid()) {
      return normalizedAddress === this.buyerAddress;
    }

    return false;
  }

  getFormattedPrice(): string {
    if (!this.currency || !this.currency.decimals) {
      return this.price;
    }

    const priceBigInt = BigInt(this.price);
    const divisor = BigInt(10 ** this.currency.decimals);
    const whole = priceBigInt / divisor;
    const fraction = priceBigInt % divisor;

    if (fraction === 0n) {
      return whole.toString();
    }

    const fractionStr = fraction
      .toString()
      .padStart(this.currency.decimals, '0');
    return `${whole}.${fractionStr.replace(/0+$/, '')}`;
  }

  getCurrencySymbol(): string {
    return this.currency?.symbol || 'ETH';
  }

  complete(): void {
    this.status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  cancel(): void {
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
  }

  expire(): void {
    this.status = 'EXPIRED';
    this.updatedAt = new Date();
  }

  updatePrice(newPrice: string): void {
    if (!this.isActive()) {
      throw new Error('Cannot update price of inactive listing');
    }

    this.price = newPrice;
    this.updatedAt = new Date();
  }

  getTimeToExpiration(): number | null {
    if (!this.expiresAt) {
      return null;
    }

    const now = new Date().getTime();
    const expirationTime = this.expiresAt.getTime();

    return Math.max(0, expirationTime - now);
  }
}
