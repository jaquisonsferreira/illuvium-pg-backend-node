import { VaultPositionEntity } from './vault-position.entity';

describe('VaultPositionEntity', () => {
  const validWallet = '0x1234567890abcdef1234567890abcdef12345678';
  const vaultAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  describe('create', () => {
    it('should create a new vault position', () => {
      const params = {
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000', // 1 ETH
        shares: '1000000000000000000',
        usdValue: 1500.75,
        snapshotDate: new Date('2024-01-15T15:30:00Z'),
        blockNumber: 18500000,
      };

      const position = VaultPositionEntity.create(params);

      expect(position.id).toBeDefined();
      expect(position.walletAddress).toBe(validWallet.toLowerCase());
      expect(position.vaultAddress).toBe(vaultAddress.toLowerCase());
      expect(position.assetSymbol).toBe('ETH');
      expect(position.chain).toBe('ethereum');
      expect(position.balance).toBe('1000000000000000000');
      expect(position.shares).toBe('1000000000000000000');
      expect(position.usdValue).toBe(1500.75);
      expect(position.blockNumber).toBe(18500000);
      expect(position.createdAt).toBeInstanceOf(Date);
    });

    it('should normalize snapshot date to start of day UTC', () => {
      const params = {
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'USDC',
        chain: 'ethereum',
        balance: '1000000',
        shares: '1000000',
        usdValue: 1000,
        snapshotDate: new Date('2024-01-15T15:30:45Z'),
        blockNumber: 18500000,
      };

      const position = VaultPositionEntity.create(params);

      expect(position.snapshotDate.toISOString()).toBe(
        '2024-01-15T00:00:00.000Z',
      );
    });

    it('should convert addresses to lowercase', () => {
      const params = {
        walletAddress: validWallet.toUpperCase(),
        vaultAddress: vaultAddress.toUpperCase(),
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '1000000000000000000',
        usdValue: 1500,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      };

      const position = VaultPositionEntity.create(params);

      expect(position.walletAddress).toBe(validWallet.toLowerCase());
      expect(position.vaultAddress).toBe(vaultAddress.toLowerCase());
    });

    it('should handle zero balance', () => {
      const params = {
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '0',
        shares: '0',
        usdValue: 0,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      };

      const position = VaultPositionEntity.create(params);

      expect(position.balance).toBe('0');
      expect(position.shares).toBe('0');
      expect(position.usdValue).toBe(0);
    });
  });

  describe('hasBalance', () => {
    it('should return true for positive balance', () => {
      const position = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '1000000000000000000',
        usdValue: 1500,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });

      expect(position.hasBalance()).toBe(true);
    });

    it('should return false for zero balance', () => {
      const position = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '0',
        shares: '0',
        usdValue: 0,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });

      expect(position.hasBalance()).toBe(false);
    });

    it('should return false if either balance or shares is zero', () => {
      const positionWithZeroBalance = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '0',
        shares: '1000000000000000000',
        usdValue: 0,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });

      const positionWithZeroShares = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '0',
        usdValue: 0,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });

      expect(positionWithZeroBalance.hasBalance()).toBe(false);
      expect(positionWithZeroShares.hasBalance()).toBe(false);
    });
  });

  describe('getSnapshotDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const position = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '1000000000000000000',
        usdValue: 1500,
        snapshotDate: new Date('2024-01-15T15:30:00Z'),
        blockNumber: 18500000,
      });

      expect(position.getSnapshotDateString()).toBe('2024-01-15');
    });
  });

  describe('isFromChain', () => {
    let position: VaultPositionEntity;

    beforeEach(() => {
      position = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '1000000000000000000',
        usdValue: 1500,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });
    });

    it('should return true for matching chain', () => {
      expect(position.isFromChain('ethereum')).toBe(true);
      expect(position.isFromChain('Ethereum')).toBe(true);
      expect(position.isFromChain('ETHEREUM')).toBe(true);
    });

    it('should return false for non-matching chain', () => {
      expect(position.isFromChain('polygon')).toBe(false);
      expect(position.isFromChain('arbitrum')).toBe(false);
    });
  });

  describe('calculateShards', () => {
    let position: VaultPositionEntity;

    beforeEach(() => {
      position = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '1000000000000000000',
        usdValue: 5000, // $5000
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });
    });

    it('should calculate shards correctly', () => {
      // 100 shards per $1000
      const shards = position.calculateShards(100);
      expect(shards).toBe(500); // 5000/1000 * 100
    });

    it('should handle different rates', () => {
      // 150 shards per $1000
      const shards = position.calculateShards(150);
      expect(shards).toBe(750); // 5000/1000 * 150
    });

    it('should handle fractional USD values', () => {
      const positionWithFractional = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '1000000000000000000',
        usdValue: 1234.56,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });

      const shards = positionWithFractional.calculateShards(100);
      expect(shards).toBeCloseTo(123.456, 3);
    });

    it('should return zero for zero USD value', () => {
      const zeroValuePosition = VaultPositionEntity.create({
        walletAddress: validWallet,
        vaultAddress: vaultAddress,
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '0',
        shares: '0',
        usdValue: 0,
        snapshotDate: new Date('2024-01-15'),
        blockNumber: 18500000,
      });

      const shards = zeroValuePosition.calculateShards(100);
      expect(shards).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should serialize vault position correctly', () => {
      const position = new VaultPositionEntity(
        'test-id',
        validWallet.toLowerCase(),
        vaultAddress.toLowerCase(),
        'ETH',
        'ethereum',
        '1000000000000000000',
        '1000000000000000000',
        1500.75,
        new Date('2024-01-15T00:00:00.000Z'),
        18500000,
        new Date('2024-01-15T10:00:00Z'),
      );

      const json = position.toJSON();

      expect(json).toEqual({
        id: 'test-id',
        walletAddress: validWallet.toLowerCase(),
        vaultAddress: vaultAddress.toLowerCase(),
        assetSymbol: 'ETH',
        chain: 'ethereum',
        balance: '1000000000000000000',
        shares: '1000000000000000000',
        usdValue: 1500.75,
        snapshotDate: '2024-01-15',
        blockNumber: 18500000,
        createdAt: new Date('2024-01-15T10:00:00Z'),
      });
    });
  });
});
