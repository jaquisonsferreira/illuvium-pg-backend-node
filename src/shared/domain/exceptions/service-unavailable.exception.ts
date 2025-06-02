import { HttpStatus } from '@nestjs/common';
import { BaseException, ErrorResponseProps } from './base.exception';

export class ServiceUnavailableException extends BaseException {
  constructor(
    message = 'Service temporarily unavailable',
    details?: Record<string, any>,
    code = 'SERVICE_UNAVAILABLE',
  ) {
    const props: ErrorResponseProps = {
      message,
      code,
      details,
    };

    super(props, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
