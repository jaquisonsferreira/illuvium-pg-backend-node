import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ResponseFormat<T> {
  status: string;
  statusCode: number;
  timestamp: string;
  path: string;
  data: T;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ResponseFormat<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const statusCode =
      context.switchToHttp().getResponse().statusCode || HttpStatus.OK;

    return next.handle().pipe(
      map((data) => {
        // Check if the response is already formatted in our standard
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'timestamp' in data
        ) {
          return data;
        }

        // Otherwise, format the success response
        return {
          status: 'success',
          statusCode,
          timestamp: new Date().toISOString(),
          path: request.url,
          data: data === undefined ? null : data,
        };
      }),
    );
  }
}
