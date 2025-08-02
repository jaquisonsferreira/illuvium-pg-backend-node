import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StakingBlockchainService } from './staking-blockchain.service';
import { ChainType } from '../../domain/types/staking-types';
import { getAddress, ethers, JsonRpcProvider, Contract } from 'ethers';

jest.mock('ethers');

describe('StakingBlockchainService', () => {
  let service: StakingBlockchainService;
  let mockProvider: jest.Mocked<JsonRpcProvider>;
  let mockContract: jest.Mocked<Contract>;

  const validWallet = '0x1234567890123456789012345678901234567890';
  const lowercaseWallet = '0xabcdef1234567890123456789012345678901234';
  const mixedCaseWallet = '0xaBcDef1234567890123456789012345678901234';
  const uppercaseWallet = '0xABCDEF1234567890123456789012345678901234';
  const vaultAddress = '0x1111111111111111111111111111111111111111';

  beforeEach(async () => {
    mockProvider = {
      getBlockNumber: jest.fn(),
      getBlock: jest.fn(),
      getNetwork: jest.fn(),
    } as any;

    mockContract = {
      balanceOf: jest.fn(),
      totalSupply: jest.fn(),
      totalAssets: jest.fn(),
      convertToAssets: jest.fn(),
      convertToShares: jest.fn(),
      maxRedeem: jest.fn(),
      maxWithdraw: jest.fn(),
      getPendingWithdrawalIds: jest.fn(),
      getPendingWithdrawal: jest.fn(),
      getLockInfo: jest.fn(),
      asset: jest.fn(),
    } as any;

    (JsonRpcProvider as jest.Mock).mockImplementation(() => mockProvider);
    (Contract as jest.Mock).mockImplementation(() => mockContract);

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        switch (key) {
          case 'BASE_RPC_URL':
            return 'https://sepolia.base.org';
          case 'OBELISK_RPC_URL':
            return 'https://rpc.obelisk.gg';
          case 'NODE_ENV':
            return 'test';
          default:
            return defaultValue;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakingBlockchainService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StakingBlockchainService>(StakingBlockchainService);
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize providers for supported chains', () => {
      expect(JsonRpcProvider).toHaveBeenCalledWith('https://sepolia.base.org', {
        chainId: 84532,
        name: 'BASE',
      });
      expect(JsonRpcProvider).toHaveBeenCalledWith('https://rpc.obelisk.gg', {
        chainId: 1001,
        name: 'OBELISK',
      });
    });
  });

  describe('Address Checksumming in getVaultPosition', () => {
    beforeEach(() => {
      mockProvider.getBlockNumber.mockResolvedValue(12345);
      mockProvider.getBlock.mockResolvedValue({
        timestamp: Math.floor(Date.now() / 1000),
        number: 12345,
      });

      mockContract.balanceOf.mockResolvedValue(ethers.parseEther('100'));
      mockContract.totalSupply.mockResolvedValue(ethers.parseEther('1000'));
      mockContract.totalAssets.mockResolvedValue(ethers.parseEther('1100'));
    });

    it('should checksum user address when getting vault position', async () => {
      const result = await service.getVaultPosition(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBeDefined();
      expect(result?.user).toBe(getAddress(lowercaseWallet).toLowerCase());
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should handle different address formats consistently', async () => {
      const testCases = [
        { input: validWallet, expected: getAddress(validWallet) },
        { input: lowercaseWallet, expected: getAddress(lowercaseWallet) },
        { input: mixedCaseWallet, expected: getAddress(mixedCaseWallet) },
        { input: uppercaseWallet, expected: getAddress(uppercaseWallet) },
      ];

      for (const testCase of testCases) {
        const result = await service.getVaultPosition(
          testCase.input,
          vaultAddress,
          ChainType.BASE,
        );

        expect(result).toBeDefined();
        expect(mockContract.balanceOf).toHaveBeenCalledWith(testCase.expected);
      }
    });

    it('should return null when user has no balance', async () => {
      mockContract.balanceOf.mockResolvedValue(0n);

      const result = await service.getVaultPosition(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBeNull();
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should throw error for invalid user address', async () => {
      const invalidAddress = 'invalid-address';

      await expect(
        service.getVaultPosition(invalidAddress, vaultAddress, ChainType.BASE),
      ).rejects.toThrow();
    });
  });

  describe('Address Checksumming in getUserVaultPositions', () => {
    beforeEach(() => {
      mockProvider.getBlockNumber.mockResolvedValue(12345);
      mockProvider.getBlock.mockResolvedValue({
        timestamp: Math.floor(Date.now() / 1000),
        number: 12345,
      });

      mockContract.balanceOf.mockResolvedValue(ethers.parseEther('100'));
      mockContract.totalSupply.mockResolvedValue(ethers.parseEther('1000'));
      mockContract.totalAssets.mockResolvedValue(ethers.parseEther('1100'));
    });

    it('should checksum user address for multiple vault positions', async () => {
      const vaultAddresses = [
        vaultAddress,
        '0x2222222222222222222222222222222222222222',
      ];

      const result = await service.getUserVaultPositions(
        lowercaseWallet,
        vaultAddresses,
        ChainType.BASE,
      );

      expect(result).toHaveLength(2);
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should handle mixed case addresses consistently', async () => {
      const vaultAddresses = [vaultAddress];

      const result = await service.getUserVaultPositions(
        mixedCaseWallet,
        vaultAddresses,
        ChainType.BASE,
      );

      expect(result).toHaveLength(1);
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(mixedCaseWallet),
      );
    });
  });

  describe('Address Checksumming in getUserPendingWithdrawals', () => {
    beforeEach(() => {
      mockContract.getPendingWithdrawalIds.mockResolvedValue([1n, 2n]);
      mockContract.getPendingWithdrawal.mockResolvedValue({
        shares: ethers.parseEther('50'),
        assets: ethers.parseEther('55'),
        requestTime: BigInt(Math.floor(Date.now() / 1000)),
        unlockTime: BigInt(Math.floor(Date.now() / 1000) + 86400),
        finalized: false,
      });
    });

    it('should checksum user address when getting pending withdrawals', async () => {
      const result = await service.getUserPendingWithdrawals(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toHaveLength(2);
      expect(mockContract.getPendingWithdrawalIds).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should handle uppercase addresses properly', async () => {
      const result = await service.getUserPendingWithdrawals(
        uppercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toHaveLength(2);
      expect(mockContract.getPendingWithdrawalIds).toHaveBeenCalledWith(
        getAddress(uppercaseWallet),
      );
    });
  });

  describe('Address Checksumming in getMaxRedeem', () => {
    beforeEach(() => {
      mockContract.maxRedeem.mockResolvedValue(ethers.parseEther('75'));
    });

    it('should checksum user address when getting max redeem', async () => {
      const result = await service.getMaxRedeem(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBe(ethers.parseEther('75').toString());
      expect(mockContract.maxRedeem).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should handle mixed case addresses', async () => {
      const result = await service.getMaxRedeem(
        mixedCaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBe(ethers.parseEther('75').toString());
      expect(mockContract.maxRedeem).toHaveBeenCalledWith(
        getAddress(mixedCaseWallet),
      );
    });
  });

  describe('Address Checksumming in getMaxWithdraw', () => {
    beforeEach(() => {
      mockContract.maxWithdraw.mockResolvedValue(ethers.parseEther('80'));
    });

    it('should checksum user address when getting max withdraw', async () => {
      const result = await service.getMaxWithdraw(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBe(ethers.parseEther('80').toString());
      expect(mockContract.maxWithdraw).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should handle uppercase addresses', async () => {
      const result = await service.getMaxWithdraw(
        uppercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBe(ethers.parseEther('80').toString());
      expect(mockContract.maxWithdraw).toHaveBeenCalledWith(
        getAddress(uppercaseWallet),
      );
    });
  });

  describe('Address Checksumming in getUserTokenBalance', () => {
    beforeEach(() => {
      mockContract.balanceOf.mockResolvedValue(ethers.parseEther('200'));
    });

    it('should checksum user address when getting token balance', async () => {
      const result = await service.getUserTokenBalance(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBe(ethers.parseEther('200').toString());
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should handle mixed case addresses consistently', async () => {
      const result = await service.getUserTokenBalance(
        mixedCaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBe(ethers.parseEther('200').toString());
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(mixedCaseWallet),
      );
    });
  });

  describe('Address Checksumming in getUserLockInfo', () => {
    beforeEach(() => {
      mockContract.getLockInfo.mockResolvedValue({
        depositTime: BigInt(Math.floor(Date.now() / 1000) - 86400),
        totalLockDuration: BigInt(2592000), // 30 days
        lastUpdateTime: BigInt(Math.floor(Date.now() / 1000)),
      });
    });

    it('should checksum user address when getting lock info', async () => {
      const result = await service.getUserLockInfo(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBeDefined();
      expect(result?.depositTime).toBeGreaterThan(0);
      expect(mockContract.getLockInfo).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });

    it('should handle uppercase addresses', async () => {
      const result = await service.getUserLockInfo(
        uppercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBeDefined();
      expect(mockContract.getLockInfo).toHaveBeenCalledWith(
        getAddress(uppercaseWallet),
      );
    });

    it('should return null when user has no lock info', async () => {
      mockContract.getLockInfo.mockResolvedValue({
        depositTime: 0n,
        totalLockDuration: 0n,
        lastUpdateTime: 0n,
      });

      const result = await service.getUserLockInfo(
        lowercaseWallet,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result).toBeNull();
      expect(mockContract.getLockInfo).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
    });
  });

  describe('Address Checksumming in getMultipleUsersTokenBalances', () => {
    beforeEach(() => {
      mockContract.balanceOf
        .mockResolvedValueOnce(ethers.parseEther('100'))
        .mockResolvedValueOnce(ethers.parseEther('200'))
        .mockResolvedValueOnce(ethers.parseEther('300'));
    });

    it('should checksum all user addresses when getting multiple balances', async () => {
      const userAddresses = [lowercaseWallet, mixedCaseWallet, uppercaseWallet];

      const result = await service.getMultipleUsersTokenBalances(
        userAddresses,
        vaultAddress,
        ChainType.BASE,
      );

      expect(result.size).toBe(3);
      expect(result.get(lowercaseWallet.toLowerCase())).toBe(
        ethers.parseEther('100').toString(),
      );
      expect(result.get(mixedCaseWallet.toLowerCase())).toBe(
        ethers.parseEther('200').toString(),
      );
      expect(result.get(uppercaseWallet.toLowerCase())).toBe(
        ethers.parseEther('300').toString(),
      );

      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(lowercaseWallet),
      );
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(mixedCaseWallet),
      );
      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        getAddress(uppercaseWallet),
      );
    });

    it('should handle invalid addresses in the array gracefully', async () => {
      const userAddresses = [validWallet, 'invalid-address'];

      await expect(
        service.getMultipleUsersTokenBalances(
          userAddresses,
          vaultAddress,
          ChainType.BASE,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid user address in getVaultPosition', async () => {
      const invalidAddress = 'invalid-address';

      await expect(
        service.getVaultPosition(invalidAddress, vaultAddress, ChainType.BASE),
      ).rejects.toThrow();
    });

    it('should handle blockchain errors gracefully', async () => {
      mockProvider.getBlockNumber.mockRejectedValue(new Error('Network error'));

      await expect(service.getCurrentBlock(ChainType.BASE)).rejects.toThrow(
        'Failed to get current block for BASE',
      );
    });

    it('should handle contract call errors in getVaultPosition', async () => {
      mockContract.balanceOf.mockRejectedValue(new Error('Contract error'));

      await expect(
        service.getVaultPosition(validWallet, vaultAddress, ChainType.BASE),
      ).rejects.toThrow('Failed to get vault position from blockchain');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when blockchain is responsive', async () => {
      mockProvider.getBlockNumber.mockResolvedValue(12345);
      mockProvider.getNetwork.mockResolvedValue({
        chainId: 84532n,
        name: 'BASE',
      });

      const result = await service.healthCheck(ChainType.BASE);

      expect(result.isHealthy).toBe(true);
      expect(result.blockNumber).toBe(12345);
      expect(result.chainId).toBe(84532);
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should return unhealthy status when blockchain is not responsive', async () => {
      mockProvider.getBlockNumber.mockRejectedValue(
        new Error('Connection timeout'),
      );

      const result = await service.healthCheck(ChainType.BASE);

      expect(result.isHealthy).toBe(false);
      expect(result.blockNumber).toBe(0);
      expect(result.chainId).toBe(0);
    });
  });
});
