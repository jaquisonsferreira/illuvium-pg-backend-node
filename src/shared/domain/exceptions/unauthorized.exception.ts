import { HttpStatus } from '@nestjs/common';
import { BaseException, ErrorResponseProps } from './base.exception';

export class UnauthorizedException extends BaseException {
  constructor(
    message = 'Unauthorized access',
    details?: Record<string, any>,
    code = 'UNAUTHORIZED',
  ) {
    const props: ErrorResponseProps = {
      message,
      code,
      details,
    };

    super(props, HttpStatus.UNAUTHORIZED);
  }
}
