import { WalletAddressValidator } from './wallet-address.validator';
import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';
import { getAddress, ZeroAddress } from 'ethers';

describe('WalletAddressValidator', () => {
  describe('validate', () => {
    it('should validate correct Ethereum address', () => {
      const address = '0x742d35cC6634c0532925A3B844Bc9e7595F89234';
      const result = WalletAddressValidator.validate(address);

      expect(result).toBe(getAddress(address));
    });

    it('should validate and return checksummed address', () => {
      const address = '0x742d35cc6634c0532925a3b844bc9e7595f89234';
      const result = WalletAddressValidator.validate(address);

      expect(result).toBe(getAddress(address));
    });

    it('should throw error for undefined address', () => {
      expect(() => WalletAddressValidator.validate(undefined)).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validate(undefined)).toThrow(
        expect.objectContaining({
          code: ErrorCodes.INVALID_ADDRESS,
          message: 'Address is required',
        }),
      );
    });

    it('should throw error for null address', () => {
      expect(() => WalletAddressValidator.validate(null)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for empty string', () => {
      expect(() => WalletAddressValidator.validate('')).toThrow(
        ValidationError,
      );
    });

    it('should throw error for whitespace only', () => {
      expect(() => WalletAddressValidator.validate('   ')).toThrow(
        ValidationError,
      );
    });

    it('should throw error for invalid address format', () => {
      expect(() => WalletAddressValidator.validate('0xinvalid')).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validate('not-an-address')).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validate('0x123')).toThrow(
        ValidationError,
      );
    });

    it('should throw error for zero address', () => {
      const zeroAddress = ZeroAddress;
      expect(() => WalletAddressValidator.validate(zeroAddress)).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validate(zeroAddress)).toThrow(
        expect.objectContaining({
          code: ErrorCodes.ZERO_ADDRESS,
          message: 'Zero address not allowed',
        }),
      );
    });

    it('should throw error for non-string types', () => {
      expect(() => WalletAddressValidator.validate(123 as any)).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validate({} as any)).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validate([] as any)).toThrow(
        ValidationError,
      );
    });
  });

  describe('validateOptional', () => {
    it('should return undefined for undefined input', () => {
      expect(
        WalletAddressValidator.validateOptional(undefined),
      ).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      expect(WalletAddressValidator.validateOptional(null)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(WalletAddressValidator.validateOptional('')).toBeUndefined();
    });

    it('should return undefined for whitespace only', () => {
      expect(WalletAddressValidator.validateOptional('   ')).toBeUndefined();
    });

    it('should validate and return checksummed address when provided', () => {
      const address = '0x742d35cc6634c0532925a3b844bc9e7595f89234';
      const result = WalletAddressValidator.validateOptional(address);

      expect(result).toBe(getAddress(address));
    });

    it('should throw error for invalid address when provided', () => {
      expect(() =>
        WalletAddressValidator.validateOptional('0xinvalid'),
      ).toThrow(ValidationError);
    });
  });

  describe('validateMultiple', () => {
    it('should validate array of addresses', () => {
      const addresses = [
        '0x742d35cC6634c0532925A3B844Bc9e7595F89234',
        '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      ];

      const result = WalletAddressValidator.validateMultiple(addresses);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(getAddress(addresses[0]));
      expect(result[1]).toBe(getAddress(addresses[1]));
    });

    it('should throw error for undefined array', () => {
      expect(() =>
        WalletAddressValidator.validateMultiple(undefined as any),
      ).toThrow(ValidationError);
    });

    it('should throw error for null array', () => {
      expect(() =>
        WalletAddressValidator.validateMultiple(null as any),
      ).toThrow(ValidationError);
    });

    it('should throw error for non-array input', () => {
      expect(() =>
        WalletAddressValidator.validateMultiple('not-array' as any),
      ).toThrow(ValidationError);
    });

    it('should throw error for empty array', () => {
      expect(() => WalletAddressValidator.validateMultiple([])).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validateMultiple([])).toThrow(
        expect.objectContaining({
          message: 'Address array cannot be empty',
        }),
      );
    });

    it('should throw error for array exceeding max length', () => {
      const addresses = new Array(101).fill(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f89234',
      );

      expect(() => WalletAddressValidator.validateMultiple(addresses)).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validateMultiple(addresses)).toThrow(
        expect.objectContaining({
          message: 'Too many addresses (max: 100)',
        }),
      );
    });

    it('should throw error with index when invalid address in array', () => {
      const addresses = [
        '0x742d35cC6634c0532925A3B844Bc9e7595F89234',
        '0xinvalid',
        '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      ];

      expect(() => WalletAddressValidator.validateMultiple(addresses)).toThrow(
        ValidationError,
      );
      expect(() => WalletAddressValidator.validateMultiple(addresses)).toThrow(
        expect.objectContaining({
          message: 'Invalid address at index 1',
        }),
      );
    });

    it('should remove duplicates from array', () => {
      const addresses = [
        '0x742d35cC6634c0532925A3B844Bc9e7595F89234',
        '0x742d35cc6634c0532925a3b844bc9e7595f89234', // Same address, different case
        '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      ];

      const result = WalletAddressValidator.validateMultiple(addresses);

      expect(result).toHaveLength(2);
      // Both addresses should be returned with proper checksums
      const checksummedAddresses = result.map((addr) =>
        getAddress(addr.toLowerCase()),
      );
      expect(checksummedAddresses).toContain(
        getAddress('0x742d35cc6634c0532925a3b844bc9e7595f89234'),
      );
      expect(checksummedAddresses).toContain(
        getAddress('0x5fbdb2315678afecb367f032d93f642f64180aa3'),
      );
    });

    it('should validate with custom max length', () => {
      const addresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f89234',
        '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      ];

      expect(() =>
        WalletAddressValidator.validateMultiple(addresses, 2),
      ).toThrow(ValidationError);
    });
  });

  describe('isZeroAddress', () => {
    it('should return true for zero address', () => {
      expect(WalletAddressValidator.isZeroAddress(ZeroAddress)).toBe(true);
    });

    it('should return false for non-zero address', () => {
      expect(
        WalletAddressValidator.isZeroAddress(
          '0x742d35Cc6634C0532925a3b844Bc9e7595f89234',
        ),
      ).toBe(false);
    });

    it('should handle lowercase zero address', () => {
      expect(
        WalletAddressValidator.isZeroAddress(
          '0x0000000000000000000000000000000000000000',
        ),
      ).toBe(true);
    });
  });
});
