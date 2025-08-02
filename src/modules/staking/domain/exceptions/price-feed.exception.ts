import { HttpException, HttpStatus } from '@nestjs/common';

export class PriceFeedException extends HttpException {
  constructor(message: string, cause?: Error) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: `Price feed error: ${message}`,
        error: 'PriceFeedError',
        cause: cause?.message,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class TokenNotSupportedException extends HttpException {
  constructor(tokenAddress: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Token not supported: ${tokenAddress}`,
        error: 'TokenNotSupported',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
