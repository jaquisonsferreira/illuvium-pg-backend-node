import { AmountValidator } from './amount.validator';
import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';

describe('AmountValidator', () => {
  describe('validateRawAmount', () => {
    it('should validate positive bigint amount', () => {
      const result = AmountValidator.validateRawAmount('1000000000000000000', {
        tokenDecimals: 18,
        allowZero: false,
      });

      expect(result).toBe(1000000000000000000n);
    });

    it('should throw error for undefined amount', () => {
      expect(() =>
        AmountValidator.validateRawAmount(undefined, {
          tokenDecimals: 18,
          allowZero: false,
        }),
      ).toThrow(ValidationError);
    });

    it('should throw error for null amount', () => {
      expect(() =>
        AmountValidator.validateRawAmount(null, {
          tokenDecimals: 18,
          allowZero: false,
        }),
      ).toThrow(ValidationError);
    });

    it('should throw error for empty string', () => {
      expect(() =>
        AmountValidator.validateRawAmount('', {
          tokenDecimals: 18,
          allowZero: false,
        }),
      ).toThrow(ValidationError);
    });

    it('should throw error for non-numeric string', () => {
      expect(() =>
        AmountValidator.validateRawAmount('abc', {
          tokenDecimals: 18,
          allowZero: false,
        }),
      ).toThrow(ValidationError);
    });

    it('should throw error for decimal amount', () => {
      expect(() =>
        AmountValidator.validateRawAmount('123.456', {
          tokenDecimals: 18,
          allowZero: false,
        }),
      ).toThrow(ValidationError);
    });

    it('should throw error for negative amount', () => {
      expect(() =>
        AmountValidator.validateRawAmount('-1000', {
          tokenDecimals: 18,
          allowZero: false,
        }),
      ).toThrow(ValidationError);
    });

    it('should allow zero when allowZero is true', () => {
      const result = AmountValidator.validateRawAmount('0', {
        tokenDecimals: 18,
        allowZero: true,
      });

      expect(result).toBe(0n);
    });

    it('should throw error for zero when allowZero is false', () => {
      expect(() =>
        AmountValidator.validateRawAmount('0', {
          tokenDecimals: 18,
          allowZero: false,
        }),
      ).toThrow(ValidationError);
    });

    it('should validate amount within max limit', () => {
      const maxAmount = BigInt('1000000000000000000000');
      const result = AmountValidator.validateRawAmount(
        '999999999999999999999',
        {
          tokenDecimals: 18,
          allowZero: false,
          maxAmount,
        },
      );

      expect(result).toBe(999999999999999999999n);
    });

    it('should throw error for amount exceeding max limit', () => {
      const maxAmount = BigInt('1000000000000000000000');

      expect(() =>
        AmountValidator.validateRawAmount('1000000000000000000001', {
          tokenDecimals: 18,
          allowZero: false,
          maxAmount,
        }),
      ).toThrow(ValidationError);
    });

    it('should validate amount above min limit', () => {
      const minAmount = BigInt('100');
      const result = AmountValidator.validateRawAmount('101', {
        tokenDecimals: 18,
        allowZero: false,
        minAmount,
      });

      expect(result).toBe(101n);
    });

    it('should throw error for amount below min limit', () => {
      const minAmount = BigInt('100');

      expect(() =>
        AmountValidator.validateRawAmount('99', {
          tokenDecimals: 18,
          allowZero: false,
          minAmount,
        }),
      ).toThrow(ValidationError);
    });

    it('should handle very large amounts', () => {
      const largeAmount =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      const result = AmountValidator.validateRawAmount(largeAmount, {
        tokenDecimals: 18,
        allowZero: false,
      });

      expect(result.toString()).toBe(largeAmount);
    });

    it('should trim whitespace from amount', () => {
      const result = AmountValidator.validateRawAmount('  1000000  ', {
        tokenDecimals: 18,
        allowZero: false,
      });

      expect(result).toBe(1000000n);
    });
  });

  describe('validateDisplayAmount', () => {
    it('should validate decimal amount with correct decimals', () => {
      const result = AmountValidator.validateDisplayAmount('1.5', 18);
      expect(result).toBe('1.5');
    });

    it('should validate integer amount', () => {
      const result = AmountValidator.validateDisplayAmount('100', 18);
      expect(result).toBe('100.0');
    });

    it('should throw error for too many decimals', () => {
      expect(() =>
        AmountValidator.validateDisplayAmount('1.123456789012345678901', 18),
      ).toThrow(ValidationError);
    });

    it('should allow exact number of decimals', () => {
      const result = AmountValidator.validateDisplayAmount(
        '1.123456789012345678',
        18,
      );
      expect(result).toBe('1.123456789012345678');
    });

    it('should handle tokens with different decimals', () => {
      const result = AmountValidator.validateDisplayAmount('1.123456', 6);
      expect(result).toBe('1.123456');

      expect(() =>
        AmountValidator.validateDisplayAmount('1.1234567', 6),
      ).toThrow(ValidationError);
    });

    it('should throw error for scientific notation', () => {
      expect(() => AmountValidator.validateDisplayAmount('1e18', 18)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for multiple decimal points', () => {
      expect(() => AmountValidator.validateDisplayAmount('1.2.3', 18)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for invalid characters', () => {
      expect(() =>
        AmountValidator.validateDisplayAmount('1,000.5', 18),
      ).toThrow(ValidationError);
    });

    it('should handle zero decimals correctly', () => {
      const result = AmountValidator.validateDisplayAmount('100', 0);
      expect(result).toBe('100');

      expect(() => AmountValidator.validateDisplayAmount('100.1', 0)).toThrow(
        ValidationError,
      );
    });
  });

  describe('toRawAmount', () => {
    it('should convert display amount to raw amount', () => {
      const result = AmountValidator.toRawAmount('1.5', 18);
      expect(result).toBe('1500000000000000000');
    });

    it('should convert integer display amount', () => {
      const result = AmountValidator.toRawAmount('100', 18);
      expect(result).toBe('100000000000000000000');
    });

    it('should handle different token decimals', () => {
      const result6 = AmountValidator.toRawAmount('1.5', 6);
      expect(result6).toBe('1500000');

      const result8 = AmountValidator.toRawAmount('1.5', 8);
      expect(result8).toBe('150000000');
    });

    it('should handle zero decimals', () => {
      const result = AmountValidator.toRawAmount('100', 0);
      expect(result).toBe('100');
    });

    it('should preserve all significant digits', () => {
      const result = AmountValidator.toRawAmount('0.000000000000000001', 18);
      expect(result).toBe('1');
    });

    it('should handle very small amounts', () => {
      const result = AmountValidator.toRawAmount('0.123456789012345678', 18);
      expect(result).toBe('123456789012345678');
    });
  });

  describe('toDisplayAmount', () => {
    it('should convert raw amount to display amount', () => {
      const result = AmountValidator.toDisplayAmount('1500000000000000000', 18);
      expect(result).toBe('1.5');
    });

    it('should handle whole numbers', () => {
      const result = AmountValidator.toDisplayAmount(
        '100000000000000000000',
        18,
      );
      expect(result).toBe('100.0');
    });

    it('should handle different token decimals', () => {
      const result6 = AmountValidator.toDisplayAmount('1500000', 6);
      expect(result6).toBe('1.5');

      const result8 = AmountValidator.toDisplayAmount('150000000', 8);
      expect(result8).toBe('1.5');
    });

    it('should handle zero decimals', () => {
      const result = AmountValidator.toDisplayAmount('100', 0);
      expect(result).toBe('100');
    });

    it('should remove trailing zeros', () => {
      const result = AmountValidator.toDisplayAmount('1000000000000000000', 18);
      expect(result).toBe('1.0');
    });

    it('should preserve all significant decimals', () => {
      const result = AmountValidator.toDisplayAmount('123456789012345678', 18);
      expect(result).toBe('0.123456789012345678');
    });

    it('should handle very small amounts', () => {
      const result = AmountValidator.toDisplayAmount('1', 18);
      expect(result).toBe('0.000000000000000001');
    });

    it('should handle zero amount', () => {
      const result = AmountValidator.toDisplayAmount('0', 18);
      expect(result).toBe('0.0');
    });
  });

  describe('compareAmounts', () => {
    it('should return 0 for equal amounts', () => {
      expect(AmountValidator.compareAmounts('1000', '1000')).toBe(0);
    });

    it('should return 1 when first amount is greater', () => {
      expect(AmountValidator.compareAmounts('1001', '1000')).toBe(1);
    });

    it('should return -1 when first amount is less', () => {
      expect(AmountValidator.compareAmounts('999', '1000')).toBe(-1);
    });

    it('should handle bigint comparisons', () => {
      const amount1 =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';
      const amount2 =
        '115792089237316195423570985008687907853269984665640564039457584007913129639934';

      expect(AmountValidator.compareAmounts(amount1, amount2)).toBe(1);
    });
  });
});
