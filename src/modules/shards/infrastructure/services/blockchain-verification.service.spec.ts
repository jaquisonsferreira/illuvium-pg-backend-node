import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainVerificationService } from './blockchain-verification.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ethers } from 'ethers';

describe('BlockchainVerificationService', () => {
  let service: BlockchainVerificationService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let mockProvider: any;

  const mockTransaction = {
    hash: '0xtxhash',
    from: '0x1234567890abcdef1234567890abcdef12345678',
    to: null,
    blockNumber: 12345678,
    confirmations: 10,
  };

  const mockReceipt = {
    hash: '0xtxhash',
    from: '0x1234567890abcdef1234567890abcdef12345678',
    contractAddress: '0xcontract1234567890abcdef1234567890abcdef',
    blockNumber: 12345678,
    status: 1,
  };

  const mockBlock = {
    number: 12345678,
    timestamp: 1642000000,
    hash: '0xblockhash',
  };

  beforeEach(async () => {
    mockProvider = {
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getCode: jest.fn(),
      getBlock: jest.fn(),
    };

    // Mock ethers.JsonRpcProvider
    jest
      .spyOn(ethers, 'JsonRpcProvider')
      .mockImplementation(() => mockProvider);

    const mockHttpService = {
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          ETHEREUM_RPC_URL: 'https://eth.test.com',
          BASE_RPC_URL: 'https://base.test.com',
          ARBITRUM_RPC_URL: 'https://arb.test.com',
          OPTIMISM_RPC_URL: 'https://op.test.com',
          ETHERSCAN_API_KEY: 'test-etherscan-key',
          BASESCAN_API_KEY: 'test-basescan-key',
          ARBISCAN_API_KEY: 'test-arbiscan-key',
          OPTIMISM_ETHERSCAN_API_KEY: 'test-optimism-key',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainVerificationService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BlockchainVerificationService>(
      BlockchainVerificationService,
    );
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyContractDeployment', () => {
    it('should verify a valid contract deployment', async () => {
      mockProvider.getTransaction.mockResolvedValue(mockTransaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);
      mockProvider.getCode.mockResolvedValue('0x606060405260...'); // Some bytecode
      mockProvider.getBlock.mockResolvedValue(mockBlock);

      const mockAxiosResponse: AxiosResponse = {
        data: { status: '1', result: 'contract ABI' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockAxiosResponse));

      const result = await service.verifyContractDeployment(
        '0xCONTRACT1234567890ABCDEF1234567890ABCDEF',
        '0x1234567890ABCDEF1234567890ABCDEF12345678',
        '0xtxhash',
        'ethereum',
      );

      expect(result).toBeDefined();
      expect(result?.contractAddress).toBe(
        '0xcontract1234567890abcdef1234567890abcdef',
      );
      expect(result?.deployerAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result?.transactionHash).toBe('0xtxhash');
      expect(result?.blockNumber).toBe(12345678);
      expect(result?.timestamp).toBe(1642000000);
      expect(result?.verified).toBe(true);
    });

    it('should return null for non-existent chain', async () => {
      const result = await service.verifyContractDeployment(
        '0xcontract',
        '0xdeployer',
        '0xtxhash',
        'unknown-chain',
      );

      expect(result).toBeNull();
    });

    it('should return null when transaction not found', async () => {
      mockProvider.getTransaction.mockResolvedValue(null);

      const result = await service.verifyContractDeployment(
        '0xcontract',
        '0xdeployer',
        '0xtxhash',
        'ethereum',
      );

      expect(result).toBeNull();
    });

    it('should return null when receipt not found', async () => {
      mockProvider.getTransaction.mockResolvedValue(mockTransaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(null);

      const result = await service.verifyContractDeployment(
        '0xcontract',
        '0xdeployer',
        '0xtxhash',
        'ethereum',
      );

      expect(result).toBeNull();
    });

    it('should return null when deployer address mismatch', async () => {
      mockProvider.getTransaction.mockResolvedValue(mockTransaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const result = await service.verifyContractDeployment(
        '0xcontract',
        '0xWRONGDEPLOYER1234567890ABCDEF1234567890AB',
        '0xtxhash',
        'ethereum',
      );

      expect(result).toBeNull();
    });

    it('should return null when contract address mismatch', async () => {
      mockProvider.getTransaction.mockResolvedValue(mockTransaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const result = await service.verifyContractDeployment(
        '0xWRONGCONTRACT1234567890ABCDEF1234567890AB',
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xtxhash',
        'ethereum',
      );

      expect(result).toBeNull();
    });

    it('should return null when no code at contract address', async () => {
      mockProvider.getTransaction.mockResolvedValue(mockTransaction);
      mockProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);
      mockProvider.getCode.mockResolvedValue('0x'); // No code

      const result = await service.verifyContractDeployment(
        '0xcontract1234567890abcdef1234567890abcdef',
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xtxhash',
        'ethereum',
      );

      expect(result).toBeNull();
    });

    it('should handle provider errors gracefully', async () => {
      mockProvider.getTransaction.mockRejectedValue(
        new Error('Provider error'),
      );

      const result = await service.verifyContractDeployment(
        '0xcontract',
        '0xdeployer',
        '0xtxhash',
        'ethereum',
      );

      expect(result).toBeNull();
    });
  });

  describe('checkContractVerification', () => {
    it('should return true for verified contract', async () => {
      const mockAxiosResponse: AxiosResponse = {
        data: { status: '1', result: 'contract ABI JSON' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockAxiosResponse));

      const result = await service.checkContractVerification(
        '0xcontract1234567890abcdef1234567890abcdef',
        'ethereum',
      );

      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('api.etherscan.io'),
      );
    });

    it('should return false for unverified contract', async () => {
      const mockAxiosResponse: AxiosResponse = {
        data: { status: '0', result: 'Contract source code not verified' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockAxiosResponse));

      const result = await service.checkContractVerification(
        '0xunverified',
        'ethereum',
      );

      expect(result).toBe(false);
    });

    it('should return false when no API key configured', async () => {
      const result = await service.checkContractVerification(
        '0xcontract',
        'polygon', // Not configured
      );

      expect(result).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.checkContractVerification(
        '0xcontract',
        'ethereum',
      );

      expect(result).toBe(false);
    });
  });

  describe('getContractCreationInfo', () => {
    it('should return contract creation info', async () => {
      const mockAxiosResponse: AxiosResponse = {
        data: {
          status: '1',
          result: [
            {
              contractCreator: '0xcreator1234567890abcdef1234567890abcdef12',
              txHash: '0xcreationtxhash',
              blockNumber: '12340000',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockAxiosResponse));

      const result = await service.getContractCreationInfo(
        '0xcontract1234567890abcdef1234567890abcdef',
        'ethereum',
      );

      expect(result).toBeDefined();
      expect(result?.creatorAddress).toBe(
        '0xcreator1234567890abcdef1234567890abcdef12',
      );
      expect(result?.transactionHash).toBe('0xcreationtxhash');
      expect(result?.blockNumber).toBe(12340000);
    });

    it('should return null when no creation info found', async () => {
      const mockAxiosResponse: AxiosResponse = {
        data: {
          status: '0',
          result: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockAxiosResponse));

      const result = await service.getContractCreationInfo(
        '0xnotfound',
        'ethereum',
      );

      expect(result).toBeNull();
    });

    it('should return null when no API key configured', async () => {
      const result = await service.getContractCreationInfo(
        '0xcontract',
        'polygon', // Not configured
      );

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.getContractCreationInfo(
        '0xcontract',
        'ethereum',
      );

      expect(result).toBeNull();
    });
  });

  describe('initialization', () => {
    it('should initialize providers for all supported chains', () => {
      expect(ethers.JsonRpcProvider).toHaveBeenCalledTimes(4); // 4 chains
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(
        'https://eth.test.com',
        1,
      );
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(
        'https://base.test.com',
        8453,
      );
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(
        'https://arb.test.com',
        42161,
      );
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(
        'https://op.test.com',
        10,
      );
    });

    it('should use default RPC URLs when not configured', async () => {
      configService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainVerificationService,
          {
            provide: HttpService,
            useValue: httpService,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const newService = module.get<BlockchainVerificationService>(
        BlockchainVerificationService,
      );

      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(
        'https://eth.llamarpc.com',
        1,
      );
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(
        'https://mainnet.base.org',
        8453,
      );
    });
  });
});
