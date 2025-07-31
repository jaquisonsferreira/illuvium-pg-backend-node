export interface ErrorDetails {
  [key: string]: any;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
    statusCode?: number;
  };
  timestamp: string;
}

export class ValidationError extends Error {
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly statusCode: number;

  constructor(code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
    this.statusCode = 400;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export class BusinessLogicError extends Error {
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly statusCode: number;

  constructor(
    code: string,
    message: string,
    details?: ErrorDetails,
    statusCode: number = 422,
  ) {
    super(message);
    this.name = 'BusinessLogicError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, BusinessLogicError.prototype);
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export class SystemError extends Error {
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly statusCode: number;

  constructor(
    code: string,
    message: string,
    details?: ErrorDetails,
    statusCode: number = 500,
  ) {
    super(message);
    this.name = 'SystemError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, SystemError.prototype);
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export class ContextError extends Error {
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly statusCode: number;

  constructor(code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'ContextError';
    this.code = code;
    this.details = details;
    this.statusCode = 400;
    Object.setPrototypeOf(this, ContextError.prototype);
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export enum ErrorCodes {
  // Validation Errors
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_PARAMS = 'INVALID_PARAMS',
  INSUFFICIENT_AMOUNT = 'INSUFFICIENT_AMOUNT',
  ZERO_ADDRESS = 'ZERO_ADDRESS',
  INVALID_VAULT = 'INVALID_VAULT',
  INVALID_CHAIN = 'INVALID_CHAIN',
  INVALID_SEASON = 'INVALID_SEASON',

  // Business Logic Errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  WITHDRAWAL_DISABLED = 'WITHDRAWAL_DISABLED',
  VAULT_DEPRECATED = 'VAULT_DEPRECATED',

  // System Errors
  SUBGRAPH_BEHIND = 'SUBGRAPH_BEHIND',
  PRICE_FEED_UNAVAILABLE = 'PRICE_FEED_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Context Errors
  SEASON_MISMATCH = 'SEASON_MISMATCH',
  CHAIN_MISMATCH = 'CHAIN_MISMATCH',
  VAULT_NOT_FOUND = 'VAULT_NOT_FOUND',
}
