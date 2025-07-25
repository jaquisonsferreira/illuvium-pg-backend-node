import { ArgumentMetadata } from '@nestjs/common';
import {
  WalletAddressValidationPipe,
  OptionalWalletAddressValidationPipe,
} from './wallet-address-validation.pipe';
import { WalletAddressValidator } from '@shared/validators/wallet-address.validator';

jest.mock('@shared/validators/wallet-address.validator');

describe('WalletAddressValidationPipe', () => {
  let pipe: WalletAddressValidationPipe;

  beforeEach(() => {
    pipe = new WalletAddressValidationPipe();
    jest.clearAllMocks();
  });

  it('should validate param type', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89234';
    const metadata: ArgumentMetadata = { type: 'param' };

    (WalletAddressValidator.validate as jest.Mock).mockReturnValue(mockAddress);

    const result = pipe.transform(mockAddress, metadata);

    expect(WalletAddressValidator.validate).toHaveBeenCalledWith(mockAddress);
    expect(result).toBe(mockAddress);
  });

  it('should validate query type', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89234';
    const metadata: ArgumentMetadata = { type: 'query' };

    (WalletAddressValidator.validate as jest.Mock).mockReturnValue(mockAddress);

    const result = pipe.transform(mockAddress, metadata);

    expect(WalletAddressValidator.validate).toHaveBeenCalledWith(mockAddress);
    expect(result).toBe(mockAddress);
  });

  it('should skip validation for body type', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89234';
    const metadata: ArgumentMetadata = { type: 'body' };

    const result = pipe.transform(mockAddress, metadata);

    expect(WalletAddressValidator.validate).not.toHaveBeenCalled();
    expect(result).toBe(mockAddress);
  });

  it('should skip validation for custom type', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89234';
    const metadata: ArgumentMetadata = { type: 'custom' };

    const result = pipe.transform(mockAddress, metadata);

    expect(WalletAddressValidator.validate).not.toHaveBeenCalled();
    expect(result).toBe(mockAddress);
  });

  it('should propagate validation errors', () => {
    const metadata: ArgumentMetadata = { type: 'param' };
    const mockError = new Error('Invalid address');

    (WalletAddressValidator.validate as jest.Mock).mockImplementation(() => {
      throw mockError;
    });

    expect(() => pipe.transform('invalid', metadata)).toThrow(mockError);
  });
});

describe('OptionalWalletAddressValidationPipe', () => {
  let pipe: OptionalWalletAddressValidationPipe;

  beforeEach(() => {
    pipe = new OptionalWalletAddressValidationPipe();
    jest.clearAllMocks();
  });

  it('should validate param type with optional validator', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89234';
    const metadata: ArgumentMetadata = { type: 'param' };

    (WalletAddressValidator.validateOptional as jest.Mock).mockReturnValue(
      mockAddress,
    );

    const result = pipe.transform(mockAddress, metadata);

    expect(WalletAddressValidator.validateOptional).toHaveBeenCalledWith(
      mockAddress,
    );
    expect(result).toBe(mockAddress);
  });

  it('should validate query type with optional validator', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89234';
    const metadata: ArgumentMetadata = { type: 'query' };

    (WalletAddressValidator.validateOptional as jest.Mock).mockReturnValue(
      mockAddress,
    );

    const result = pipe.transform(mockAddress, metadata);

    expect(WalletAddressValidator.validateOptional).toHaveBeenCalledWith(
      mockAddress,
    );
    expect(result).toBe(mockAddress);
  });

  it('should handle undefined values', () => {
    const metadata: ArgumentMetadata = { type: 'param' };

    (WalletAddressValidator.validateOptional as jest.Mock).mockReturnValue(
      undefined,
    );

    const result = pipe.transform(undefined, metadata);

    expect(WalletAddressValidator.validateOptional).toHaveBeenCalledWith(
      undefined,
    );
    expect(result).toBeUndefined();
  });

  it('should skip validation for body type', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f89234';
    const metadata: ArgumentMetadata = { type: 'body' };

    const result = pipe.transform(mockAddress, metadata);

    expect(WalletAddressValidator.validateOptional).not.toHaveBeenCalled();
    expect(result).toBe(mockAddress);
  });

  it('should propagate validation errors', () => {
    const metadata: ArgumentMetadata = { type: 'param' };
    const mockError = new Error('Invalid address');

    (WalletAddressValidator.validateOptional as jest.Mock).mockImplementation(
      () => {
        throw mockError;
      },
    );

    expect(() => pipe.transform('invalid', metadata)).toThrow(mockError);
  });
});
