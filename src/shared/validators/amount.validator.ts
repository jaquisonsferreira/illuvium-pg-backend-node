import { formatUnits, parseUnits } from 'ethers';
import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';

export interface AmountValidationOptions {
  tokenDecimals: number;
  minimumAmount?: string;
  maximumAmount?: string;
  maxAmount?: bigint;
  minAmount?: bigint;
  allowZero?: boolean;
}

export interface VaultConfig {
  minimum_deposit: string;
  maximum_deposit?: string;
  token_decimals: number;
}

export class AmountValidator {
  static validateRawAmount(
    amountRaw: string | undefined | null,
    options: AmountValidationOptions,
  ): bigint {
    if (!amountRaw || typeof amountRaw !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Amount is required',
        {
          provided_amount: amountRaw,
          expected_format: 'String representation of integer',
        },
      );
    }

    const trimmedAmount = amountRaw.trim();

    // Check if it's a valid number format
    if (!/^\d+$/.test(trimmedAmount)) {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Amount must contain only digits',
        {
          provided_amount: trimmedAmount,
          expected_format:
            'Numeric string without decimals or special characters',
        },
      );
    }

    let bigIntAmount: bigint;
    try {
      bigIntAmount = BigInt(trimmedAmount);
    } catch (error) {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Invalid amount format',
        {
          provided_amount: trimmedAmount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
    }

    // Check for zero amount
    if (bigIntAmount === 0n && !options.allowZero) {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Amount must be greater than zero',
        {
          provided_amount: trimmedAmount,
        },
      );
    }

    // Check for negative amount
    if (bigIntAmount < 0n) {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Amount cannot be negative',
        {
          provided_amount: trimmedAmount,
        },
      );
    }

    // Check minimum amount (support both string and bigint)
    if (options.minimumAmount || options.minAmount) {
      const minAmount = options.minAmount || BigInt(options.minimumAmount!);
      if (bigIntAmount < minAmount) {
        const formattedMin = formatUnits(minAmount, options.tokenDecimals);
        throw new ValidationError(
          ErrorCodes.INSUFFICIENT_AMOUNT,
          `Amount is below minimum of ${formattedMin}`,
          {
            provided_amount: formatUnits(bigIntAmount, options.tokenDecimals),
            minimum_amount: formattedMin,
            token_decimals: options.tokenDecimals,
          },
        );
      }
    }

    // Check maximum amount (support both string and bigint)
    if (options.maximumAmount || options.maxAmount) {
      const maxAmount = options.maxAmount || BigInt(options.maximumAmount!);
      if (bigIntAmount > maxAmount) {
        const formattedMax = formatUnits(maxAmount, options.tokenDecimals);
        throw new ValidationError(
          ErrorCodes.INVALID_AMOUNT,
          `Amount exceeds maximum of ${formattedMax}`,
          {
            provided_amount: formatUnits(bigIntAmount, options.tokenDecimals),
            maximum_amount: formattedMax,
            token_decimals: options.tokenDecimals,
          },
        );
      }
    }

    return bigIntAmount;
  }

  static validateDisplayAmount(
    displayAmount: string | undefined | null,
    tokenDecimals: number,
  ): string {
    if (!displayAmount || typeof displayAmount !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Display amount is required',
        {
          provided_amount: displayAmount,
          expected_format: 'String representation of decimal number',
        },
      );
    }

    const trimmedAmount = displayAmount.trim();

    // Check if it's a valid decimal format
    if (!/^\d+(\.\d+)?$/.test(trimmedAmount)) {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Invalid display amount format',
        {
          provided_amount: trimmedAmount,
          expected_format: '123.456 or 123',
        },
      );
    }

    // Check decimal places
    const parts = trimmedAmount.split('.');
    if (parts.length > 1) {
      const decimalPlaces = parts[1].length;
      if (decimalPlaces > tokenDecimals) {
        throw new ValidationError(
          ErrorCodes.INVALID_AMOUNT,
          `Too many decimal places. Maximum ${tokenDecimals} allowed`,
          {
            provided_amount: trimmedAmount,
            decimal_places: decimalPlaces,
            max_decimals: tokenDecimals,
          },
        );
      }
    }

    // Parse to ensure it's a valid number
    const numericValue = parseFloat(trimmedAmount);
    if (isNaN(numericValue) || !isFinite(numericValue)) {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Invalid numeric value',
        {
          provided_amount: trimmedAmount,
        },
      );
    }

    // Convert to raw amount and back to verify precision
    try {
      const rawAmount = parseUnits(trimmedAmount, tokenDecimals);
      return formatUnits(rawAmount, tokenDecimals);
    } catch (error) {
      throw new ValidationError(
        ErrorCodes.INVALID_AMOUNT,
        'Amount conversion failed',
        {
          provided_amount: trimmedAmount,
          token_decimals: tokenDecimals,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
    }
  }

  static validateVaultDeposit(
    amountRaw: string,
    vaultConfig: VaultConfig,
  ): bigint {
    const validatedAmount = this.validateRawAmount(amountRaw, {
      tokenDecimals: vaultConfig.token_decimals,
      minimumAmount: parseUnits(
        vaultConfig.minimum_deposit,
        vaultConfig.token_decimals,
      ).toString(),
      maximumAmount: vaultConfig.maximum_deposit
        ? parseUnits(
            vaultConfig.maximum_deposit,
            vaultConfig.token_decimals,
          ).toString()
        : undefined,
      allowZero: false,
    });

    return validatedAmount;
  }

  static formatAmount(
    amountRaw: string | bigint,
    tokenDecimals: number,
  ): string {
    const bigIntAmount =
      typeof amountRaw === 'string' ? BigInt(amountRaw) : amountRaw;
    return formatUnits(bigIntAmount, tokenDecimals);
  }

  static parseAmount(displayAmount: string, tokenDecimals: number): string {
    const validated = this.validateDisplayAmount(displayAmount, tokenDecimals);
    return parseUnits(validated, tokenDecimals).toString();
  }

  static toRawAmount(displayAmount: string, tokenDecimals: number): string {
    return this.parseAmount(displayAmount, tokenDecimals);
  }

  static toDisplayAmount(rawAmount: string, tokenDecimals: number): string {
    return this.formatAmount(rawAmount, tokenDecimals);
  }

  static compareAmounts(amount1: string, amount2: string): number {
    const bigInt1 = BigInt(amount1);
    const bigInt2 = BigInt(amount2);

    if (bigInt1 > bigInt2) return 1;
    if (bigInt1 < bigInt2) return -1;
    return 0;
  }
}
