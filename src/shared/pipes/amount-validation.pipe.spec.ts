import { ArgumentMetadata } from '@nestjs/common';
import {
  AmountValidationPipe,
  DisplayAmountValidationPipe,
} from './amount-validation.pipe';
import { AmountValidator } from '@shared/validators/amount.validator';

jest.mock('@shared/validators/amount.validator');

describe('AmountValidationPipe', () => {
  let pipe: AmountValidationPipe;
  const tokenDecimals = 18;

  beforeEach(() => {
    pipe = new AmountValidationPipe(tokenDecimals);
    jest.clearAllMocks();
  });

  it('should validate body type', () => {
    const mockAmount = '1000000000000000000';
    const metadata: ArgumentMetadata = { type: 'body' };
    
    (AmountValidator.validateRawAmount as jest.Mock).mockReturnValue(BigInt(mockAmount));

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateRawAmount).toHaveBeenCalledWith(mockAmount, {
      tokenDecimals: 18,
      allowZero: false,
    });
    expect(result).toBe(mockAmount);
  });

  it('should validate query type', () => {
    const mockAmount = '1000000000000000000';
    const metadata: ArgumentMetadata = { type: 'query' };
    
    (AmountValidator.validateRawAmount as jest.Mock).mockReturnValue(BigInt(mockAmount));

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateRawAmount).toHaveBeenCalledWith(mockAmount, {
      tokenDecimals: 18,
      allowZero: false,
    });
    expect(result).toBe(mockAmount);
  });

  it('should skip validation for param type', () => {
    const mockAmount = '1000000000000000000';
    const metadata: ArgumentMetadata = { type: 'param' };

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateRawAmount).not.toHaveBeenCalled();
    expect(result).toBe(mockAmount);
  });

  it('should skip validation for custom type', () => {
    const mockAmount = '1000000000000000000';
    const metadata: ArgumentMetadata = { type: 'custom' };

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateRawAmount).not.toHaveBeenCalled();
    expect(result).toBe(mockAmount);
  });

  it('should return string representation of validated amount', () => {
    const mockAmount = '999999999999999999';
    const metadata: ArgumentMetadata = { type: 'body' };
    
    (AmountValidator.validateRawAmount as jest.Mock).mockReturnValue(BigInt(mockAmount));

    const result = pipe.transform(mockAmount, metadata);

    expect(result).toBe(mockAmount);
    expect(typeof result).toBe('string');
  });

  it('should propagate validation errors', () => {
    const metadata: ArgumentMetadata = { type: 'body' };
    const mockError = new Error('Invalid amount');
    
    (AmountValidator.validateRawAmount as jest.Mock).mockImplementation(() => {
      throw mockError;
    });

    expect(() => pipe.transform('invalid', metadata)).toThrow(mockError);
  });

  it('should use correct token decimals', () => {
    const customPipe = new AmountValidationPipe(6);
    const mockAmount = '1000000';
    const metadata: ArgumentMetadata = { type: 'body' };
    
    (AmountValidator.validateRawAmount as jest.Mock).mockReturnValue(BigInt(mockAmount));

    customPipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateRawAmount).toHaveBeenCalledWith(mockAmount, {
      tokenDecimals: 6,
      allowZero: false,
    });
  });
});

describe('DisplayAmountValidationPipe', () => {
  let pipe: DisplayAmountValidationPipe;
  const tokenDecimals = 18;

  beforeEach(() => {
    pipe = new DisplayAmountValidationPipe(tokenDecimals);
    jest.clearAllMocks();
  });

  it('should validate body type', () => {
    const mockAmount = '1.5';
    const metadata: ArgumentMetadata = { type: 'body' };
    
    (AmountValidator.validateDisplayAmount as jest.Mock).mockReturnValue(mockAmount);

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateDisplayAmount).toHaveBeenCalledWith(mockAmount, 18);
    expect(result).toBe(mockAmount);
  });

  it('should validate query type', () => {
    const mockAmount = '100.123';
    const metadata: ArgumentMetadata = { type: 'query' };
    
    (AmountValidator.validateDisplayAmount as jest.Mock).mockReturnValue(mockAmount);

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateDisplayAmount).toHaveBeenCalledWith(mockAmount, 18);
    expect(result).toBe(mockAmount);
  });

  it('should skip validation for param type', () => {
    const mockAmount = '1.5';
    const metadata: ArgumentMetadata = { type: 'param' };

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateDisplayAmount).not.toHaveBeenCalled();
    expect(result).toBe(mockAmount);
  });

  it('should skip validation for custom type', () => {
    const mockAmount = '1.5';
    const metadata: ArgumentMetadata = { type: 'custom' };

    const result = pipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateDisplayAmount).not.toHaveBeenCalled();
    expect(result).toBe(mockAmount);
  });

  it('should propagate validation errors', () => {
    const metadata: ArgumentMetadata = { type: 'body' };
    const mockError = new Error('Invalid display amount');
    
    (AmountValidator.validateDisplayAmount as jest.Mock).mockImplementation(() => {
      throw mockError;
    });

    expect(() => pipe.transform('invalid', metadata)).toThrow(mockError);
  });

  it('should use correct token decimals', () => {
    const customPipe = new DisplayAmountValidationPipe(6);
    const mockAmount = '1.123456';
    const metadata: ArgumentMetadata = { type: 'body' };
    
    (AmountValidator.validateDisplayAmount as jest.Mock).mockReturnValue(mockAmount);

    customPipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateDisplayAmount).toHaveBeenCalledWith(mockAmount, 6);
  });

  it('should handle zero decimal tokens', () => {
    const customPipe = new DisplayAmountValidationPipe(0);
    const mockAmount = '100';
    const metadata: ArgumentMetadata = { type: 'body' };
    
    (AmountValidator.validateDisplayAmount as jest.Mock).mockReturnValue(mockAmount);

    customPipe.transform(mockAmount, metadata);

    expect(AmountValidator.validateDisplayAmount).toHaveBeenCalledWith(mockAmount, 0);
  });
});