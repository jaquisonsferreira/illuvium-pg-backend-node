import { 
  VaultTransaction as IVaultTransaction, 
  TransactionType, 
  TransactionStatus 
} from '../types/staking-types';

export class VaultTransaction implements IVaultTransaction {
  constructor(
    public readonly id: string,
    public readonly vaultAddress: string,
    public readonly userAddress: string,
    public readonly type: TransactionType,
    public readonly assets: string,
    public readonly shares: string,
    public readonly timestamp: number,
    public readonly blockNumber: number,
    public readonly transactionHash: string,
    public readonly status: TransactionStatus,
  ) {
    this.validateId(id);
    this.validateAddress(vaultAddress, 'vaultAddress');
    this.validateAddress(userAddress, 'userAddress');
    this.validateType(type);
    this.validateBalance(assets, 'assets');
    this.validateBalance(shares, 'shares');
    this.validateTimestamp(timestamp);
    this.validateBlock(blockNumber);
    this.validateTransactionHash(transactionHash);
    this.validateStatus(status);
  }

  /**
   * Creates a VaultTransaction from raw subgraph data
   */
  static fromSubgraphData(data: {
    id: string;
    vault: string;
    user: string;
    type: string;
    assets: string;
    shares: string;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
    status?: string;
  }): VaultTransaction {
    return new VaultTransaction(
      data.id,
      data.vault.toLowerCase(),
      data.user.toLowerCase(),
      data.type as TransactionType,
      data.assets,
      data.shares,
      data.timestamp,
      data.blockNumber,
      data.transactionHash.toLowerCase(),
      (data.status as TransactionStatus) || TransactionStatus.CONFIRMED,
    );
  }

  /**
   * Creates a transaction from blockchain event data
   */
  static fromBlockchainEvent(data: {
    eventName: string;
    vaultAddress: string;
    blockNumber: number;
    transactionHash: string;
    timestamp: number;
    args: Record<string, any>;
  }): VaultTransaction {
    const type = VaultTransaction.mapEventNameToType(data.eventName);
    const id = `${data.transactionHash}-${data.args.logIndex || 0}`;
    
    return new VaultTransaction(
      id,
      data.vaultAddress.toLowerCase(),
      (data.args.user || data.args.owner || data.args.sender).toLowerCase(),
      type,
      data.args.assets || '0',
      data.args.shares || '0',
      data.timestamp,
      data.blockNumber,
      data.transactionHash.toLowerCase(),
      TransactionStatus.CONFIRMED,
    );
  }

  /**
   * Maps blockchain event names to transaction types
   */
  private static mapEventNameToType(eventName: string): TransactionType {
    switch (eventName.toLowerCase()) {
      case 'deposit':
      case 'vaultdeposit':
        return TransactionType.DEPOSIT;
      case 'withdraw':
      case 'vaultwithdrawal':
        return TransactionType.WITHDRAWAL;
      case 'transfer':
      case 'vaulttransfer':
        return TransactionType.TRANSFER;
      default:
        throw new Error(`Unknown event name: ${eventName}`);
    }
  }

  /**
   * Checks if this is a deposit transaction
   */
  isDeposit(): boolean {
    return this.type === TransactionType.DEPOSIT;
  }

  /**
   * Checks if this is a withdrawal transaction
   */
  isWithdrawal(): boolean {
    return this.type === TransactionType.WITHDRAWAL;
  }

  /**
   * Checks if this is a transfer transaction
   */
  isTransfer(): boolean {
    return this.type === TransactionType.TRANSFER;
  }

  /**
   * Checks if the transaction is pending
   */
  isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }

  /**
   * Checks if the transaction is confirmed
   */
  isConfirmed(): boolean {
    return this.status === TransactionStatus.CONFIRMED;
  }

  /**
   * Checks if the transaction failed
   */
  isFailed(): boolean {
    return this.status === TransactionStatus.FAILED;
  }

  /**
   * Gets the asset amount as BigInt for calculations
   */
  getAssetsBigInt(): bigint {
    return BigInt(this.assets);
  }

  /**
   * Gets the shares amount as BigInt for calculations
   */
  getSharesBigInt(): bigint {
    return BigInt(this.shares);
  }

  /**
   * Formats asset amount for display with specified decimals
   */
  formatAssets(decimals: number, displayDecimals: number = 2): string {
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = this.getAssetsBigInt() / divisor;
    const fractionalPart = this.getAssetsBigInt() % divisor;
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.slice(0, displayDecimals);
    
    return `${wholePart}.${trimmedFractional}`;
  }

  /**
   * Formats shares amount for display with specified decimals
   */
  formatShares(decimals: number, displayDecimals: number = 2): string {
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = this.getSharesBigInt() / divisor;
    const fractionalPart = this.getSharesBigInt() % divisor;
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.slice(0, displayDecimals);
    
    return `${wholePart}.${trimmedFractional}`;
  }

  /**
   * Calculates USD value of the transaction
   */
  calculateUsdValue(pricePerToken: number, decimals: number): number {
    const assetAmount = parseFloat(this.formatAssets(decimals, 8));
    return assetAmount * pricePerToken;
  }

  /**
   * Gets the transaction age in seconds
   */
  getAgeInSeconds(): number {
    return Math.floor(Date.now() / 1000) - this.timestamp;
  }

  /**
   * Gets the transaction age in a human-readable format
   */
  getFormattedAge(): string {
    const ageInSeconds = this.getAgeInSeconds();
    
    if (ageInSeconds < 60) {
      return `${ageInSeconds}s ago`;
    } else if (ageInSeconds < 3600) {
      return `${Math.floor(ageInSeconds / 60)}m ago`;
    } else if (ageInSeconds < 86400) {
      return `${Math.floor(ageInSeconds / 3600)}h ago`;
    } else {
      return `${Math.floor(ageInSeconds / 86400)}d ago`;
    }
  }

  /**
   * Creates a copy with updated status
   */
  withStatus(newStatus: TransactionStatus): VaultTransaction {
    return new VaultTransaction(
      this.id,
      this.vaultAddress,
      this.userAddress,
      this.type,
      this.assets,
      this.shares,
      this.timestamp,
      this.blockNumber,
      this.transactionHash,
      newStatus,
    );
  }

  /**
   * Converts to plain object for serialization
   */
  toJSON(): IVaultTransaction {
    return {
      id: this.id,
      vaultAddress: this.vaultAddress,
      userAddress: this.userAddress,
      type: this.type,
      assets: this.assets,
      shares: this.shares,
      timestamp: this.timestamp,
      blockNumber: this.blockNumber,
      transactionHash: this.transactionHash,
      status: this.status,
    };
  }

  private validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Transaction ID is required and must be a string');
    }
  }

  private validateAddress(address: string, fieldName: string): void {
    if (!address || typeof address !== 'string') {
      throw new Error(`${fieldName} is required and must be a string`);
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error(`${fieldName} must be a valid Ethereum address`);
    }
  }

  private validateType(type: TransactionType): void {
    if (!Object.values(TransactionType).includes(type)) {
      throw new Error('Invalid transaction type');
    }
  }

  private validateBalance(balance: string, fieldName: string): void {
    if (!balance || typeof balance !== 'string') {
      throw new Error(`${fieldName} is required and must be a string`);
    }

    try {
      const bigintValue = BigInt(balance);
      if (bigintValue < 0n) {
        throw new Error(`${fieldName} must be non-negative`);
      }
    } catch (error) {
      throw new Error(`${fieldName} must be a valid BigInt string`);
    }
  }

  private validateTimestamp(timestamp: number): void {
    if (!Number.isInteger(timestamp) || timestamp < 0) {
      throw new Error('Timestamp must be a non-negative integer');
    }
  }

  private validateBlock(block: number): void {
    if (!Number.isInteger(block) || block < 0) {
      throw new Error('Block number must be a non-negative integer');
    }
  }

  private validateTransactionHash(hash: string): void {
    if (!hash || typeof hash !== 'string') {
      throw new Error('Transaction hash is required and must be a string');
    }
    
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      throw new Error('Transaction hash must be a valid 32-byte hex string');
    }
  }

  private validateStatus(status: TransactionStatus): void {
    if (!Object.values(TransactionStatus).includes(status)) {
      throw new Error('Invalid transaction status');
    }
  }
} 