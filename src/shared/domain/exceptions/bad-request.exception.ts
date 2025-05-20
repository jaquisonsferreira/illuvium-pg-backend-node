import { HttpStatus } from '@nestjs/common';
import { BaseException, ErrorResponseProps } from './base.exception';

export class BadRequestException extends BaseException {
  constructor(
    message: string,
    details?: Record<string, any>,
    code = 'BAD_REQUEST',
  ) {
    const props: ErrorResponseProps = {
      message,
      code,
      details,
    };

    super(props, HttpStatus.BAD_REQUEST);
  }
}
