import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ValidationError,
  BusinessLogicError,
  SystemError,
  ContextError,
  ErrorResponse,
} from '@shared/errors/validation.error';

@Injectable()
export class ErrorResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorResponseInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest();

        let statusCode: number;
        let errorResponse: ErrorResponse;

        // Handle custom errors
        if (
          error instanceof ValidationError ||
          error instanceof BusinessLogicError ||
          error instanceof SystemError ||
          error instanceof ContextError
        ) {
          statusCode = error.statusCode;
          errorResponse = error.toJSON();
        }
        // Handle NestJS HttpException
        else if (error instanceof HttpException) {
          statusCode = error.getStatus();
          const exceptionResponse = error.getResponse();

          errorResponse = {
            error: {
              code: 'HTTP_ERROR',
              message:
                typeof exceptionResponse === 'string'
                  ? exceptionResponse
                  : (exceptionResponse as any).message || error.message,
              statusCode,
            },
            timestamp: new Date().toISOString(),
          };
        }
        // Handle unknown errors
        else {
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          const isDevelopment = process.env.NODE_ENV !== 'production';

          errorResponse = {
            error: {
              code: 'INTERNAL_ERROR',
              message:
                isDevelopment && error.message
                  ? error.message
                  : 'Internal server error',
            },
            timestamp: new Date().toISOString(),
          };
        }

        // Log errors
        this.logger.error('Request failed', {
          method: request.method,
          url: request.url,
          statusCode,
          errorCode: errorResponse.error.code,
          errorMessage: errorResponse.error.message,
          ip: request.ip,
          headers: request.headers,
          ...(error.stack && { stack: error.stack }),
        });

        response.status(statusCode).json(errorResponse);
        return throwError(() => error);
      }),
    );
  }
}
