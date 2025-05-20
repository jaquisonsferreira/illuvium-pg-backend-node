import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationException } from '../../domain/exceptions';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    // Verify if it is a standard NestJS validation exception (class-validator)
    if (
      typeof exceptionResponse === 'object' &&
      (exceptionResponse.message instanceof Array ||
        (exceptionResponse.message &&
          typeof exceptionResponse.message === 'object'))
    ) {
      const validationErrors =
        exceptionResponse.message instanceof Array
          ? exceptionResponse.message
          : [exceptionResponse.message];

      // Transform in our custom format
      const customException = new ValidationException('Validation error', {
        fields: validationErrors,
      });

      const errorResponse = customException.getResponse() as Record<
        string,
        any
      >;

      this.logger.warn(`Validation error: ${JSON.stringify(validationErrors)}`);

      return response.status(status).json({
        statusCode: status,
        message: errorResponse.message,
        code: errorResponse.code,
        timestamp: errorResponse.timestamp,
        details: errorResponse.details,
        path: ctx.getRequest().url,
      });
    }

    // If it is not a standard validation exception, return the original exception formatted
    return response.status(status).json({
      statusCode: status,
      message: exceptionResponse.message || 'Invalid request',
      code: 'BAD_REQUEST',
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
    });
  }
}
