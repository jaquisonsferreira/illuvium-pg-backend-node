import { Test, TestingModule } from '@nestjs/testing';
import { TokenDecimalsService } from './token-decimals.service';
import { IStakingBlockchainRepository } from '../../domain/types/staking-types';

describe('TokenDecimalsService', () => {
  let service: TokenDecimalsService;
  let blockchainRepository: jest.Mocked<IStakingBlockchainRepository>;

  beforeEach(async () => {
    const mockBlockchainRepository = {
      getTokenMetadata: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenDecimalsService,
        {
          provide: 'IStakingBlockchainRepository',
          useValue: mockBlockchainRepository,
        },
      ],
    }).compile();

    service = module.get<TokenDecimalsService>(TokenDecimalsService);
    blockchainRepository = module.get('IStakingBlockchainRepository');
  });

  describe('getDecimals', () => {
    it('should return cached decimals if available', async () => {
      const tokenAddress = '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E';
      const chain = 'base';

      const decimals = await service.getDecimals(tokenAddress, chain);
      expect(decimals).toBe(18);

      const secondCall = await service.getDecimals(tokenAddress, chain);
      expect(secondCall).toBe(18);
      expect(blockchainRepository.getTokenMetadata).not.toHaveBeenCalled();
    });

    it('should return known decimals for USDC', async () => {
      const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const chain = 'base';

      const decimals = await service.getDecimals(usdcAddress, chain);
      expect(decimals).toBe(6);
    });

    it('should fetch decimals from blockchain for unknown tokens', async () => {
      const unknownToken = '0x1234567890123456789012345678901234567890';
      const chain = 'base';

      blockchainRepository.getTokenMetadata.mockResolvedValue({
        address: unknownToken,
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 8,
        isLP: false,
      });

      const decimals = await service.getDecimals(unknownToken, chain);
      expect(decimals).toBe(8);
      expect(blockchainRepository.getTokenMetadata).toHaveBeenCalledWith(
        unknownToken,
        chain,
      );
    });

    it('should return default decimals on error', async () => {
      const unknownToken = '0x1234567890123456789012345678901234567890';
      const chain = 'base';

      blockchainRepository.getTokenMetadata.mockRejectedValue(
        new Error('Network error'),
      );

      const decimals = await service.getDecimals(unknownToken, chain);
      expect(decimals).toBe(18);
    });
  });

  describe('getBatchDecimals', () => {
    it('should return decimals for multiple tokens', async () => {
      const tokens = [
        '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E',
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      ];
      const chain = 'base';

      const result = await service.getBatchDecimals(tokens, chain);

      expect(result.size).toBe(2);
      expect(result.get(tokens[0].toLowerCase())).toBe(18);
      expect(result.get(tokens[1].toLowerCase())).toBe(6);
    });
  });

  describe('formatTokenAmount', () => {
    it('should format token amount correctly', () => {
      const rawAmount = '1000000000000000000';
      const decimals = 18;

      const formatted = service.formatTokenAmount(rawAmount, decimals);
      expect(formatted).toBe('1.0');
    });

    it('should handle USDC decimals', () => {
      const rawAmount = '1000000';
      const decimals = 6;

      const formatted = service.formatTokenAmount(rawAmount, decimals);
      expect(formatted).toBe('1.0');
    });

    it('should return 0 on error', () => {
      const invalidAmount = 'invalid';
      const decimals = 18;

      const formatted = service.formatTokenAmount(invalidAmount, decimals);
      expect(formatted).toBe('0');
    });
  });

  describe('parseTokenAmount', () => {
    it('should parse token amount correctly', () => {
      const formattedAmount = '1.5';
      const decimals = 18;

      const parsed = service.parseTokenAmount(formattedAmount, decimals);
      expect(parsed).toBe('1500000000000000000');
    });

    it('should handle USDC decimals', () => {
      const formattedAmount = '100.5';
      const decimals = 6;

      const parsed = service.parseTokenAmount(formattedAmount, decimals);
      expect(parsed).toBe('100500000');
    });

    it('should return 0 on error', () => {
      const invalidAmount = 'invalid';
      const decimals = 18;

      const parsed = service.parseTokenAmount(invalidAmount, decimals);
      expect(parsed).toBe('0');
    });
  });

  describe('formatWithFixedDecimals', () => {
    it('should format with fixed decimal places', () => {
      const rawAmount = '1234567890000000000';
      const decimals = 18;

      const formatted = service.formatWithFixedDecimals(rawAmount, decimals, 2);
      expect(formatted).toBe('1.23');
    });

    it('should pad decimal places if needed', () => {
      const rawAmount = '1000000000000000000';
      const decimals = 18;

      const formatted = service.formatWithFixedDecimals(rawAmount, decimals, 4);
      expect(formatted).toBe('1.0000');
    });

    it('should handle zero decimals', () => {
      const rawAmount = '1234';
      const decimals = 0;

      const formatted = service.formatWithFixedDecimals(rawAmount, decimals, 2);
      expect(formatted).toBe('1234.00');
    });
  });

  describe('addKnownToken', () => {
    it('should add token to known list', async () => {
      const newToken = '0x9999999999999999999999999999999999999999';
      const chain = 'base';

      service.addKnownToken(newToken, 12);

      const decimals = await service.getDecimals(newToken, chain);
      expect(decimals).toBe(12);
      expect(blockchainRepository.getTokenMetadata).not.toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      const tokenAddress = '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E';
      const chain = 'base';

      await service.getDecimals(tokenAddress, chain);
      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      service.clearCache();

      const statsAfterClear = service.getCacheStats();
      expect(statsAfterClear.size).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const tokenAddress = '0x767FE9EDC9E0dF98E07454847909b5E959D7ca0E';
      const chain = 'base';

      await service.getDecimals(tokenAddress, chain);

      const stats = service.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.tokens).toContain(`${chain}:${tokenAddress.toLowerCase()}`);
    });
  });
});
