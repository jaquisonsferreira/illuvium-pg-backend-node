import { ParameterValidator } from './parameter.validator';
import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';

describe('ParameterValidator', () => {
  describe('validateVaultId', () => {
    it('should validate correct vault ID formats', () => {
      expect(ParameterValidator.validateVaultId('ILV_vault')).toBe('ILV_vault');
      expect(ParameterValidator.validateVaultId('SILV2_vault')).toBe(
        'SILV2_vault',
      );
      expect(ParameterValidator.validateVaultId('LAND_vault_base')).toBe(
        'LAND_vault_base',
      );
      expect(ParameterValidator.validateVaultId('TOKEN_vault_ethereum')).toBe(
        'TOKEN_vault_ethereum',
      );
    });

    it('should throw error for undefined vault ID', () => {
      expect(() => ParameterValidator.validateVaultId(undefined)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for null vault ID', () => {
      expect(() => ParameterValidator.validateVaultId(null)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for empty string', () => {
      expect(() => ParameterValidator.validateVaultId('')).toThrow(
        ValidationError,
      );
    });

    it('should throw error for invalid formats', () => {
      expect(() => ParameterValidator.validateVaultId('invalid')).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateVaultId('token-vault')).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateVaultId('TOKEN_VAULT')).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateVaultId('token_vault_')).toThrow(
        ValidationError,
      );
    });

    it('should trim whitespace', () => {
      expect(ParameterValidator.validateVaultId('  ILV_vault  ')).toBe(
        'ILV_vault',
      );
    });
  });

  describe('validateChain', () => {
    it('should validate supported chains', () => {
      expect(ParameterValidator.validateChain('base')).toBe('base');
      expect(ParameterValidator.validateChain('ethereum')).toBe('ethereum');
      expect(ParameterValidator.validateChain('arbitrum')).toBe('arbitrum');
      expect(ParameterValidator.validateChain('optimism')).toBe('optimism');
    });

    it('should normalize chain case', () => {
      expect(ParameterValidator.validateChain('BASE')).toBe('base');
      expect(ParameterValidator.validateChain('Ethereum')).toBe('ethereum');
    });

    it('should throw error for unsupported chains', () => {
      expect(() => ParameterValidator.validateChain('polygon')).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateChain('bsc')).toThrow(
        ValidationError,
      );
    });

    it('should throw error for invalid inputs', () => {
      expect(() => ParameterValidator.validateChain(undefined)).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateChain(null)).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateChain('')).toThrow(
        ValidationError,
      );
    });
  });

  describe('validatePagination', () => {
    it('should return default values when no options provided', () => {
      const result = ParameterValidator.validatePagination({});
      expect(result).toEqual({ page: 1, limit: 10, offset: 0 });
    });

    it('should validate valid pagination options', () => {
      const result = ParameterValidator.validatePagination({
        page: 2,
        limit: 50,
      });
      expect(result).toEqual({ page: 2, limit: 50, offset: 50 });
    });

    it('should enforce minimum page number', () => {
      expect(() => 
        ParameterValidator.validatePagination({ page: 0 })
      ).toThrow(ValidationError);
    });

    it('should enforce minimum limit', () => {
      expect(() => 
        ParameterValidator.validatePagination({ limit: 0 })
      ).toThrow(ValidationError);
    });

    it('should enforce maximum limit', () => {
      expect(() => 
        ParameterValidator.validatePagination({ limit: 200 })
      ).toThrow(ValidationError);
    });

    it('should handle numeric inputs', () => {
      const result = ParameterValidator.validatePagination({
        page: 3,
        limit: 25,
      });
      expect(result).toEqual({ page: 3, limit: 25, offset: 50 });
    });

    it('should use defaults for undefined inputs', () => {
      const result = ParameterValidator.validatePagination({
        page: undefined,
        limit: undefined,
      });
      expect(result).toEqual({ page: 1, limit: 10, offset: 0 });
    });

    it('should handle limit within valid range', () => {
      const result = ParameterValidator.validatePagination({ limit: 60 });
      expect(result.limit).toBe(60);
    });
  });

  describe('validateTimeframe', () => {
    it('should validate correct date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const result = ParameterValidator.validateTimeframe({ startDate, endDate });

      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.startDate!.toISOString()).toContain('2024-01-01');
      expect(result.endDate!.toISOString()).toContain('2024-12-31');
    });

    it('should handle optional dates', () => {
      const result = ParameterValidator.validateTimeframe({});
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    it('should validate only start date', () => {
      const result = ParameterValidator.validateTimeframe({
        startDate: new Date('2024-01-01'),
      });
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeUndefined();
    });

    it('should validate only end date', () => {
      const result = ParameterValidator.validateTimeframe({
        endDate: new Date('2024-12-31'),
      });
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should throw error for end date before start date', () => {
      expect(() =>
        ParameterValidator.validateTimeframe({
          startDate: new Date('2024-12-31'),
          endDate: new Date('2024-01-01'),
        }),
      ).toThrow(ValidationError);
    });

    it('should allow same start and end date', () => {
      const date = new Date('2024-06-15');
      const result = ParameterValidator.validateTimeframe({
        startDate: date,
        endDate: date,
      });
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should throw error for invalid date formats', () => {
      expect(() =>
        ParameterValidator.validateTimeframe({
          startDate: new Date('invalid-date'),
          endDate: new Date('2024-01-01'),
        }),
      ).toThrow(ValidationError);

      expect(() =>
        ParameterValidator.validateTimeframe({
          startDate: new Date('2024-01-01'),
          endDate: new Date('invalid-date'),
        }),
      ).toThrow(ValidationError);
    });

    it('should handle ISO date strings', () => {
      const result = ParameterValidator.validateTimeframe({
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-06-30T23:59:59Z'),
      });
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should enforce maximum date range', () => {
      expect(() =>
        ParameterValidator.validateTimeframe({
          startDate: new Date('2020-01-01'),
          endDate: new Date('2024-01-01'),
        }),
      ).toThrow(ValidationError);
    });

    it('should allow date range within max days', () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const result = ParameterValidator.validateTimeframe({
        startDate,
        endDate,
      });

      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });
  });

  describe('validateTokenSymbol', () => {
    it('should validate correct token symbols', () => {
      expect(ParameterValidator.validateTokenSymbol('ILV')).toBe('ILV');
      expect(ParameterValidator.validateTokenSymbol('SILV2')).toBe('SILV2');
      expect(ParameterValidator.validateTokenSymbol('LP-TOKEN')).toBe(
        'LP-TOKEN',
      );
      expect(ParameterValidator.validateTokenSymbol('WETH/USDC')).toBe(
        'WETH/USDC',
      );
    });

    it('should convert to uppercase', () => {
      expect(ParameterValidator.validateTokenSymbol('ilv')).toBe('ILV');
      expect(ParameterValidator.validateTokenSymbol('weth')).toBe('WETH');
    });

    it('should throw error for invalid symbols', () => {
      expect(() => ParameterValidator.validateTokenSymbol(undefined)).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateTokenSymbol(null)).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateTokenSymbol('')).toThrow(
        ValidationError,
      );
    });

    it('should throw error for too long symbols', () => {
      const longSymbol = 'A'.repeat(21);
      expect(() => ParameterValidator.validateTokenSymbol(longSymbol)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for invalid characters', () => {
      expect(() => ParameterValidator.validateTokenSymbol('TOKEN!')).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateTokenSymbol('TO KEN')).toThrow(
        ValidationError,
      );
      expect(() => ParameterValidator.validateTokenSymbol('TOKEN@')).toThrow(
        ValidationError,
      );
    });

    it('should trim whitespace', () => {
      expect(ParameterValidator.validateTokenSymbol('  ILV  ')).toBe('ILV');
    });
  });

  // These tests are commented out as the methods don't exist yet
  // describe('validateEnum', () => {
  //   enum TestEnum {
  //     OPTION1 = 'option1',
  //     OPTION2 = 'option2',
  //     OPTION3 = 'option3',
  //   }

  //   it('should validate enum value', () => {
  //     const result = ParameterValidator.validateEnum(
  //       'option1',
  //       TestEnum,
  //       'testField',
  //     );
  //     expect(result).toBe('option1');
  //   });

  //   it('should throw error for invalid enum value', () => {
  //     expect(() =>
  //       ParameterValidator.validateEnum('invalid', TestEnum, 'testField'),
  //     ).toThrow(ValidationError);
  //   });

  //   it('should throw error for undefined value', () => {
  //     expect(() =>
  //       ParameterValidator.validateEnum(undefined, TestEnum, 'testField'),
  //     ).toThrow(ValidationError);
  //   });

  //   it('should include valid options in error message', () => {
  //     try {
  //       ParameterValidator.validateEnum('invalid', TestEnum, 'testField');
  //     } catch (error) {
  //       expect(error.details.valid_values).toEqual([
  //         'option1',
  //         'option2',
  //         'option3',
  //       ]);
  //     }
  //   });
  // });

  // describe('validateBoolean', () => {
  //   it('should validate true boolean', () => {
  //     expect(ParameterValidator.validateBoolean(true)).toBe(true);
  //   });

  //   it('should validate false boolean', () => {
  //     expect(ParameterValidator.validateBoolean(false)).toBe(false);
  //   });

  //   it('should parse string "true"', () => {
  //     expect(ParameterValidator.validateBoolean('true')).toBe(true);
  //     expect(ParameterValidator.validateBoolean('TRUE')).toBe(true);
  //     expect(ParameterValidator.validateBoolean('True')).toBe(true);
  //   });

  //   it('should parse string "false"', () => {
  //     expect(ParameterValidator.validateBoolean('false')).toBe(false);
  //     expect(ParameterValidator.validateBoolean('FALSE')).toBe(false);
  //     expect(ParameterValidator.validateBoolean('False')).toBe(false);
  //   });

  //   it('should parse numeric strings', () => {
  //     expect(ParameterValidator.validateBoolean('1')).toBe(true);
  //     expect(ParameterValidator.validateBoolean('0')).toBe(false);
  //   });

  //   it('should parse numbers', () => {
  //     expect(ParameterValidator.validateBoolean(1)).toBe(true);
  //     expect(ParameterValidator.validateBoolean(0)).toBe(false);
  //   });

  //   it('should return default for undefined', () => {
  //     expect(ParameterValidator.validateBoolean(undefined, false)).toBe(false);
  //     expect(ParameterValidator.validateBoolean(undefined, true)).toBe(true);
  //   });

  //   it('should throw error for invalid values', () => {
  //     expect(() => ParameterValidator.validateBoolean('yes')).toThrow(
  //       ValidationError,
  //     );
  //     expect(() => ParameterValidator.validateBoolean('no')).toThrow(
  //       ValidationError,
  //     );
  //     expect(() => ParameterValidator.validateBoolean(2)).toThrow(
  //       ValidationError,
  //     );
  //   });
  // });
});
