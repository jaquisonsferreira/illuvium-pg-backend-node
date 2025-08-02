import {
  ValidationError,
  BusinessLogicError,
  SystemError,
  ContextError,
  ErrorCodes,
} from './validation.error';

describe('Custom Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with basic properties', () => {
      const error = new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address',
      );

      expect(error.code).toBe(ErrorCodes.INVALID_ADDRESS);
      expect(error.message).toBe('Invalid address');
      expect(error.statusCode).toBe(400);
      expect(error.details).toBeUndefined();
    });

    it('should create validation error with details', () => {
      const details = { field: 'address', value: '0x123' };
      const error = new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address',
        details,
      );

      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON correctly', () => {
      const error = new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address',
        { field: 'address' },
      );

      const json = error.toJSON();
      expect(json.error.code).toBe(ErrorCodes.INVALID_ADDRESS);
      expect(json.error.message).toBe('Invalid address');
      expect(json.error.details).toEqual({ field: 'address' });
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('BusinessLogicError', () => {
    it('should create business logic error with default status code', () => {
      const error = new BusinessLogicError(
        'INSUFFICIENT_BALANCE',
        'Not enough funds',
      );

      expect(error.code).toBe('INSUFFICIENT_BALANCE');
      expect(error.message).toBe('Not enough funds');
      expect(error.statusCode).toBe(422);
    });

    it('should create business logic error with custom status code', () => {
      const error = new BusinessLogicError(
        'SEASON_ENDED',
        'Season has ended',
        { season: 2 },
        403,
      );

      expect(error.statusCode).toBe(403);
      expect(error.details).toEqual({ season: 2 });
    });
  });

  describe('SystemError', () => {
    it('should create system error with default status code', () => {
      const error = new SystemError('DATABASE_ERROR', 'Connection failed');

      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(500);
    });

    it('should create system error with custom status code', () => {
      const error = new SystemError(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests',
        { limit: 100 },
        429,
      );

      expect(error.statusCode).toBe(429);
      expect(error.details).toEqual({ limit: 100 });
    });
  });

  describe('ContextError', () => {
    it('should create context error', () => {
      const error = new ContextError('INVALID_CHAIN', 'Chain not supported');

      expect(error.code).toBe('INVALID_CHAIN');
      expect(error.message).toBe('Chain not supported');
      expect(error.statusCode).toBe(400);
    });

    it('should serialize with context information', () => {
      const error = new ContextError('INVALID_SEASON', 'Invalid season', {
        requested: 3,
        current: 2,
      });

      const json = error.toJSON();
      expect(json.error.details).toEqual({ requested: 3, current: 2 });
    });
  });

  describe('Error Codes', () => {
    it('should have all required error codes', () => {
      expect(ErrorCodes.INVALID_ADDRESS).toBe('INVALID_ADDRESS');
      expect(ErrorCodes.INVALID_AMOUNT).toBe('INVALID_AMOUNT');
      expect(ErrorCodes.INVALID_PARAMS).toBe('INVALID_PARAMS');
      expect(ErrorCodes.ZERO_ADDRESS).toBe('ZERO_ADDRESS');
      expect(ErrorCodes.INSUFFICIENT_BALANCE).toBe('INSUFFICIENT_BALANCE');
      expect(ErrorCodes.INVALID_VAULT).toBe('INVALID_VAULT');
      expect(ErrorCodes.INVALID_CHAIN).toBe('INVALID_CHAIN');
      expect(ErrorCodes.INVALID_SEASON).toBe('INVALID_SEASON');
    });
  });
});
