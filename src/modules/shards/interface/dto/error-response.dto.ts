import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationErrorDto {
  @ApiProperty({
    description: 'Field that failed validation',
    example: 'wallet',
  })
  field: string;

  @ApiProperty({
    description: 'Validation error message',
    example: 'Invalid wallet address format',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Rejected value',
    example: '0xinvalid',
  })
  value?: any;
}

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error code for client handling',
    example: 'INVALID_WALLET_ADDRESS',
  })
  error: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'The provided wallet address is invalid',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Additional error details',
    type: [ValidationErrorDto],
  })
  details?: ValidationErrorDto[];

  @ApiProperty({
    description: 'Request path',
    example: '/api/shards/0xinvalid',
  })
  path: string;

  @ApiProperty({
    description: 'Error timestamp',
    example: '2025-01-15T15:45:30Z',
  })
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Request ID for tracking',
    example: 'req_1234567890',
  })
  requestId?: string;
}

// Common error codes
export enum ErrorCode {
  // Validation errors
  INVALID_WALLET_ADDRESS = 'INVALID_WALLET_ADDRESS',
  INVALID_SEASON_ID = 'INVALID_SEASON_ID',
  INVALID_CHAIN = 'INVALID_CHAIN',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  INVALID_PAGINATION = 'INVALID_PAGINATION',

  // Business logic errors
  SEASON_CHAIN_MISMATCH = 'SEASON_CHAIN_MISMATCH',
  SEASON_NOT_FOUND = 'SEASON_NOT_FOUND',
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  NO_VAULT_POSITIONS = 'NO_VAULT_POSITIONS',
  REFERRAL_LIMIT_EXCEEDED = 'REFERRAL_LIMIT_EXCEEDED',
  SELF_REFERRAL_NOT_ALLOWED = 'SELF_REFERRAL_NOT_ALLOWED',
  REFERRAL_CODE_NOT_FOUND = 'REFERRAL_CODE_NOT_FOUND',
  DUPLICATE_REFERRAL = 'DUPLICATE_REFERRAL',

  // System errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  PROCESSING_IN_PROGRESS = 'PROCESSING_IN_PROGRESS',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

// Helper class for creating standardized errors
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    public message: string,
    public details?: ValidationErrorDto[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static invalidWalletAddress(wallet: string): ApiError {
    return new ApiError(
      400,
      ErrorCode.INVALID_WALLET_ADDRESS,
      'The provided wallet address is invalid',
      [
        {
          field: 'wallet',
          message: 'Must be a valid Ethereum address',
          value: wallet,
        },
      ],
    );
  }

  static seasonNotFound(seasonId: number): ApiError {
    return new ApiError(
      404,
      ErrorCode.SEASON_NOT_FOUND,
      `Season ${seasonId} not found`,
    );
  }

  static seasonChainMismatch(
    season: number,
    expectedChain: string,
    providedChain: string,
  ): ApiError {
    return new ApiError(
      400,
      ErrorCode.SEASON_CHAIN_MISMATCH,
      `Season ${season} operates on ${expectedChain} chain, not ${providedChain}`,
      [
        {
          field: 'chain',
          message: `Must use ${expectedChain} for season ${season}`,
          value: providedChain,
        },
      ],
    );
  }

  static referralLimitExceeded(limit: number): ApiError {
    return new ApiError(
      400,
      ErrorCode.REFERRAL_LIMIT_EXCEEDED,
      `Maximum referral limit of ${limit} per season has been reached`,
    );
  }

  static selfReferralNotAllowed(): ApiError {
    return new ApiError(
      400,
      ErrorCode.SELF_REFERRAL_NOT_ALLOWED,
      'You cannot refer yourself',
    );
  }

  static externalServiceError(service: string): ApiError {
    return new ApiError(
      503,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `External service ${service} is temporarily unavailable`,
    );
  }

  static rateLimitExceeded(limit: number): ApiError {
    return new ApiError(
      429,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Maximum ${limit} requests per minute`,
    );
  }
}
