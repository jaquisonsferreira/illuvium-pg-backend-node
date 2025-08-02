import { validate } from 'class-validator';
import { ZeroAddress } from 'ethers';
import {
  IsEthereumAddress,
  IsNotZeroAddress,
  IsBigIntString,
  IsPositiveBigInt,
  IsVaultId,
  IsSupportedChain,
  IsTokenSymbol,
} from './validation.decorators';

describe('Validation Decorators', () => {
  describe('@IsEthereumAddress', () => {
    class TestDto {
      @IsEthereumAddress()
      address: string;
    }

    it('should validate correct Ethereum address', async () => {
      const dto = new TestDto();
      dto.address = '0x742d35cC6634c0532925A3B844Bc9e7595F89234';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail for invalid address', async () => {
      const dto = new TestDto();
      dto.address = '0xinvalid';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isEthereumAddress');
    });

    it('should fail for non-string values', async () => {
      const dto = new TestDto();
      dto.address = 123 as any;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
    });
  });

  describe('@IsNotZeroAddress', () => {
    class TestDto {
      @IsNotZeroAddress()
      address: string;
    }

    it('should validate non-zero address', async () => {
      const dto = new TestDto();
      dto.address = '0x742d35cC6634c0532925A3B844Bc9e7595F89234';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail for zero address', async () => {
      const dto = new TestDto();
      dto.address = ZeroAddress;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isNotZeroAddress');
    });

    it('should fail for invalid address format', async () => {
      const dto = new TestDto();
      dto.address = '0xinvalid';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
    });
  });

  describe('@IsBigIntString', () => {
    class TestDto {
      @IsBigIntString()
      amount: string;
    }

    it('should validate valid integer string', async () => {
      const dto = new TestDto();
      dto.amount = '1234567890';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate large integer string', async () => {
      const dto = new TestDto();
      dto.amount =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail for decimal numbers', async () => {
      const dto = new TestDto();
      dto.amount = '123.456';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isBigIntString');
    });

    it('should fail for non-numeric strings', async () => {
      const dto = new TestDto();
      dto.amount = 'abc';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
    });

    it('should fail for non-string values', async () => {
      const dto = new TestDto();
      dto.amount = 123 as any;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
    });
  });

  describe('@IsPositiveBigInt', () => {
    class TestDto {
      @IsPositiveBigInt()
      amount: string;
    }

    it('should validate positive integer string', async () => {
      const dto = new TestDto();
      dto.amount = '1000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail for zero', async () => {
      const dto = new TestDto();
      dto.amount = '0';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isPositiveBigInt');
    });

    it('should fail for negative numbers', async () => {
      const dto = new TestDto();
      dto.amount = '-100';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
    });

    it('should fail for invalid number format', async () => {
      const dto = new TestDto();
      dto.amount = 'not-a-number';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
    });
  });

  describe('@IsVaultId', () => {
    class TestDto {
      @IsVaultId()
      vaultId: string;
    }

    it('should validate correct vault ID formats', async () => {
      const validVaultIds = [
        'ILV_vault',
        'SILV2_vault',
        'LAND_vault_base',
        'TOKEN_vault_ethereum',
      ];

      for (const vaultId of validVaultIds) {
        const dto = new TestDto();
        dto.vaultId = vaultId;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should fail for invalid vault ID formats', async () => {
      const invalidVaultIds = [
        'invalid',
        'token-vault',
        'TOKEN_VAULT',
        'token_vault_',
        'vault',
      ];

      for (const vaultId of invalidVaultIds) {
        const dto = new TestDto();
        dto.vaultId = vaultId;

        const errors = await validate(dto);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints).toHaveProperty('isVaultId');
      }
    });
  });

  describe('@IsSupportedChain', () => {
    class TestDto {
      @IsSupportedChain()
      chain: string;
    }

    it('should validate supported chains', async () => {
      const supportedChains = ['base', 'ethereum', 'arbitrum', 'optimism'];

      for (const chain of supportedChains) {
        const dto = new TestDto();
        dto.chain = chain;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should validate uppercase chains', async () => {
      const dto = new TestDto();
      dto.chain = 'BASE';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail for unsupported chains', async () => {
      const dto = new TestDto();
      dto.chain = 'polygon';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isSupportedChain');
    });
  });

  describe('@IsTokenSymbol', () => {
    class TestDto {
      @IsTokenSymbol()
      symbol: string;
    }

    it('should validate correct token symbols', async () => {
      const validSymbols = ['ILV', 'SILV2', 'LP-TOKEN', 'WETH/USDC', 'ETH'];

      for (const symbol of validSymbols) {
        const dto = new TestDto();
        dto.symbol = symbol;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should validate lowercase symbols', async () => {
      const dto = new TestDto();
      dto.symbol = 'ilv';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail for symbols that are too long', async () => {
      const dto = new TestDto();
      dto.symbol = 'A'.repeat(21);

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isTokenSymbol');
    });

    it('should fail for symbols with invalid characters', async () => {
      const invalidSymbols = ['TOKEN!', 'TO KEN', 'TOKEN@', 'TOKEN#'];

      for (const symbol of invalidSymbols) {
        const dto = new TestDto();
        dto.symbol = symbol;

        const errors = await validate(dto);
        expect(errors).toHaveLength(1);
      }
    });
  });

  describe('Combined validators', () => {
    class ComplexDto {
      @IsEthereumAddress()
      @IsNotZeroAddress()
      address: string;

      @IsBigIntString()
      @IsPositiveBigInt()
      amount: string;
    }

    it('should validate when all constraints pass', async () => {
      const dto = new ComplexDto();
      dto.address = '0x742d35cC6634c0532925A3B844Bc9e7595F89234';
      dto.amount = '1000000000000000000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with multiple errors for zero address', async () => {
      const dto = new ComplexDto();
      dto.address = ZeroAddress;
      dto.amount = '1000';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isNotZeroAddress');
    });

    it('should fail with multiple errors for invalid amount', async () => {
      const dto = new ComplexDto();
      dto.address = '0x742d35cC6634c0532925A3B844Bc9e7595F89234';
      dto.amount = '0';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isPositiveBigInt');
    });
  });
});
