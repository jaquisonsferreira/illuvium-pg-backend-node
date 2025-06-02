import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorResponseProps {
  message: string;
  code: string;
  timestamp?: string;
  details?: Record<string, any>;
  stack?: string;
}

export class BaseException extends HttpException {
  public readonly timestamp: string;
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(
    props: ErrorResponseProps,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(
      {
        message: props.message,
        code: props.code,
        timestamp: props.timestamp || new Date().toISOString(),
        details: props.details || {},
      },
      statusCode,
    );

    this.code = props.code;
    this.timestamp = props.timestamp || new Date().toISOString();
    this.details = props.details;

    // Capture the current stack trace for debugging
    if (props.stack) {
      this.stack = props.stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
