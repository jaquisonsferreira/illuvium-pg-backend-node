import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';

import { BaseException } from '../../domain/exceptions';

interface ErrorResponse {
  statusCode: number;
  message: string;
  code: string;
  timestamp: string;
  path: string;
  details?: Record<string, any>;
}

interface RequestWithUser extends Request {
  user?: {
    id?: string | number;
    username?: string;
    email?: string;
    [key: string]: any;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithUser>();
    const path = httpAdapter.getRequestUrl(request);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ErrorResponse;

    if (exception instanceof BaseException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse() as Record<string, any>;

      errorResponse = {
        statusCode,
        message: exceptionResponse.message,
        code: exceptionResponse.code,
        timestamp: exceptionResponse.timestamp,
        path,
        details: exceptionResponse.details,
      };

      this.logger.error(
        `[${errorResponse.code}] ${errorResponse.message}`,
        exception.stack,
      );
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorResponse = {
          statusCode,
          message: exceptionResponse,
          code: `HTTP_ERROR_${statusCode}`,
          timestamp: new Date().toISOString(),
          path,
        };
      } else {
        const response = exceptionResponse as Record<string, any>;
        errorResponse = {
          statusCode,
          message: response.message || 'Internal server error',
          code: response.code || `HTTP_ERROR_${statusCode}`,
          timestamp: new Date().toISOString(),
          path,
          details: response.details,
        };
      }

      this.logger.error(
        `[${errorResponse.code}] ${errorResponse.message}`,
        exception.stack,
      );
    } else {
      const error = exception as Error;
      errorResponse = {
        statusCode,
        message: error?.message || 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
        path,
      };

      this.logger.error(`Exceção não tratada: ${error?.message}`, error?.stack);
    }

    httpAdapter.reply(ctx.getResponse(), errorResponse, statusCode);
  }
}
