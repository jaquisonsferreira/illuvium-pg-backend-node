import { isAddress, getAddress, ZeroAddress } from 'ethers';
import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';

export class WalletAddressValidator {
  static validate(address: string | undefined | null): string {
    if (!address || typeof address !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Address is required',
        {
          provided_address: address,
          expected_format: '0x followed by 40 hexadecimal characters',
        },
      );
    }

    const trimmedAddress = address.trim();

    if (!isAddress(trimmedAddress)) {
      throw new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid Ethereum address format',
        {
          provided_address: trimmedAddress,
          expected_format: '0x1234567890abcdef1234567890abcdef1234ABCD',
        },
      );
    }

    if (trimmedAddress === ZeroAddress) {
      throw new ValidationError(
        ErrorCodes.ZERO_ADDRESS,
        'Zero address not allowed',
        {
          provided_address: trimmedAddress,
          reason: 'Zero address (0x0...0) cannot be used for this operation',
        },
      );
    }

    // Return checksummed address
    return getAddress(trimmedAddress);
  }

  static validateMultiple(
    addresses: string[] | undefined | null,
    maxLength: number = 100,
  ): string[] {
    if (!addresses || !Array.isArray(addresses)) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Addresses must be an array',
        {
          provided_type: typeof addresses,
          expected_type: 'array',
        },
      );
    }

    if (addresses.length === 0) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Address array cannot be empty',
        {
          provided_count: 0,
          minimum_required: 1,
        },
      );
    }

    if (addresses.length > maxLength) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        `Too many addresses (max: ${maxLength})`,
        {
          provided_count: addresses.length,
          max_allowed: maxLength,
        },
      );
    }

    const uniqueAddresses = new Set<string>();
    const validatedAddresses: string[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      let validatedAddress: string;
      try {
        validatedAddress = this.validate(address);
      } catch (error) {
        throw new ValidationError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid address at index ${i}`,
          {
            index: i,
            address,
            original_error:
              error instanceof Error ? error.message : 'Unknown error',
          },
        );
      }
      const lowerCaseAddress = validatedAddress.toLowerCase();

      if (!uniqueAddresses.has(lowerCaseAddress)) {
        uniqueAddresses.add(lowerCaseAddress);
        validatedAddresses.push(validatedAddress);
      }
    }

    return validatedAddresses;
  }

  static isZeroAddress(address: string): boolean {
    return address.toLowerCase() === ZeroAddress.toLowerCase();
  }

  static validateOptional(address?: string | null): string | undefined {
    if (!address || address.trim() === '') {
      return undefined;
    }
    return this.validate(address);
  }
}
