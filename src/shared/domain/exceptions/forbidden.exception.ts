import { HttpStatus } from '@nestjs/common';
import { BaseException, ErrorResponseProps } from './base.exception';

export class ForbiddenException extends BaseException {
  constructor(
    message = 'Access forbidden',
    details?: Record<string, any>,
    code = 'FORBIDDEN',
  ) {
    const props: ErrorResponseProps = {
      message,
      code,
      details,
    };

    super(props, HttpStatus.FORBIDDEN);
  }
}
