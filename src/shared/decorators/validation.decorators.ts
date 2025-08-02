import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isAddress, ZeroAddress } from 'ethers';

// Ethereum Address Validator
@ValidatorConstraint({ name: 'isEthereumAddress', async: false })
export class IsEthereumAddressConstraint
  implements ValidatorConstraintInterface
{
  validate(address: any, args: ValidationArguments) {
    if (typeof address !== 'string') return false;
    return isAddress(address);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid Ethereum address format';
  }
}

export function IsEthereumAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEthereumAddressConstraint,
    });
  };
}

// Not Zero Address Validator
@ValidatorConstraint({ name: 'isNotZeroAddress', async: false })
export class IsNotZeroAddressConstraint
  implements ValidatorConstraintInterface
{
  validate(address: any, args: ValidationArguments) {
    if (typeof address !== 'string') return false;
    if (!isAddress(address)) return false;
    return address !== ZeroAddress;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Zero address not allowed';
  }
}

export function IsNotZeroAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotZeroAddressConstraint,
    });
  };
}

// BigInt String Validator
@ValidatorConstraint({ name: 'isBigIntString', async: false })
export class IsBigIntStringConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    try {
      BigInt(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return 'Value must be a valid integer string';
  }
}

export function IsBigIntString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBigIntStringConstraint,
    });
  };
}

// Positive BigInt Validator
@ValidatorConstraint({ name: 'isPositiveBigInt', async: false })
export class IsPositiveBigIntConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    try {
      const bigIntValue = BigInt(value);
      return bigIntValue > 0n;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return 'Value must be a positive integer';
  }
}

export function IsPositiveBigInt(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveBigIntConstraint,
    });
  };
}

// Vault ID Validator
@ValidatorConstraint({ name: 'isVaultId', async: false })
export class IsVaultIdConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return /^[A-Z0-9_]+_vault(_[a-z]+)?$/.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid vault ID format. Expected format: TOKEN_vault_chain';
  }
}

export function IsVaultId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsVaultIdConstraint,
    });
  };
}

// Chain Validator
@ValidatorConstraint({ name: 'isSupportedChain', async: false })
export class IsSupportedChainConstraint
  implements ValidatorConstraintInterface
{
  private readonly supportedChains = [
    'base',
    'ethereum',
    'arbitrum',
    'optimism',
  ];

  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return this.supportedChains.includes(value.toLowerCase());
  }

  defaultMessage(args: ValidationArguments) {
    return `Chain must be one of: ${this.supportedChains.join(', ')}`;
  }
}

export function IsSupportedChain(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSupportedChainConstraint,
    });
  };
}

// Token Symbol Validator
@ValidatorConstraint({ name: 'isTokenSymbol', async: false })
export class IsTokenSymbolConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return /^[A-Z0-9\-/]+$/.test(value.toUpperCase()) && value.length <= 20;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid token symbol format';
  }
}

export function IsTokenSymbol(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsTokenSymbolConstraint,
    });
  };
}
