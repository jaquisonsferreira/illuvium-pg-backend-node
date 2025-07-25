import {
  ExecutionContext,
  CallHandler,
  HttpException,
  Logger,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ErrorResponseInterceptor } from './error-response.interceptor';
import {
  ValidationError,
  BusinessLogicError,
  SystemError,
  ErrorCodes,
} from '@shared/errors/validation.error';

describe('ErrorResponseInterceptor', () => {
  let interceptor: ErrorResponseInterceptor;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;
  let mockResponse: any;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new ErrorResponseInterceptor();

    mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {},
      ip: '192.168.1.1',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn(),
    };

    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful requests', () => {
    it('should pass through successful responses', (done) => {
      const mockData = { result: 'success' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(mockData));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(mockData);
          expect(mockResponse.status).not.toHaveBeenCalled();
          expect(mockResponse.json).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('custom error handling', () => {
    it('should handle ValidationError', (done) => {
      const error = new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address format',
        { field: 'address', value: '0x123' },
      );

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockResponse.status).toHaveBeenCalledWith(400);
          expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
              code: ErrorCodes.INVALID_ADDRESS,
              message: 'Invalid address format',
              details: { field: 'address', value: '0x123' },
            },
            timestamp: expect.any(String),
          });
          done();
        },
      });
    });

    it('should handle BusinessLogicError', (done) => {
      const error = new BusinessLogicError(
        'INSUFFICIENT_BALANCE',
        'Not enough funds',
        { required: 100, available: 50 },
        422,
      );

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockResponse.status).toHaveBeenCalledWith(422);
          expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
              code: 'INSUFFICIENT_BALANCE',
              message: 'Not enough funds',
              details: { required: 100, available: 50 },
            },
            timestamp: expect.any(String),
          });
          done();
        },
      });
    });

    it('should handle SystemError', (done) => {
      const error = new SystemError(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests',
        { limit: 100, retry_after: 60 },
        429,
      );

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockResponse.status).toHaveBeenCalledWith(429);
          expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              details: { limit: 100, retry_after: 60 },
            },
            timestamp: expect.any(String),
          });
          done();
        },
      });
    });
  });

  describe('HttpException handling', () => {
    it('should handle standard HttpException', (done) => {
      const error = new HttpException('Not Found', 404);

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockResponse.status).toHaveBeenCalledWith(404);
          expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
              code: 'HTTP_ERROR',
              message: 'Not Found',
              statusCode: 404,
            },
            timestamp: expect.any(String),
          });
          done();
        },
      });
    });

    it('should handle HttpException with object response', (done) => {
      const errorResponse = {
        message: 'Validation failed',
        error: 'Bad Request',
        statusCode: 400,
      };
      const error = new HttpException(errorResponse, 400);

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockResponse.status).toHaveBeenCalledWith(400);
          expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
              code: 'HTTP_ERROR',
              message: 'Validation failed',
              statusCode: 400,
            },
            timestamp: expect.any(String),
          });
          done();
        },
      });
    });
  });

  describe('generic error handling', () => {
    it('should handle generic errors', (done) => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new Error('Something went wrong');

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockResponse.status).toHaveBeenCalledWith(500);
          expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Internal server error',
            },
            timestamp: expect.any(String),
          });
          process.env.NODE_ENV = originalEnv;
          done();
        },
      });
    });

    it('should handle non-Error objects', (done) => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = 'String error';

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockResponse.status).toHaveBeenCalledWith(500);
          expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Internal server error',
            },
            timestamp: expect.any(String),
          });
          process.env.NODE_ENV = originalEnv;
          done();
        },
      });
    });
  });

  describe('logging', () => {
    it('should log errors with request context', (done) => {
      const error = new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address',
      );

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            'Request failed',
            expect.objectContaining({
              method: 'GET',
              url: '/api/test',
              statusCode: 400,
              errorCode: ErrorCodes.INVALID_ADDRESS,
              errorMessage: 'Invalid address',
              ip: '192.168.1.1',
            }),
          );
          done();
        },
      });
    });

    it('should include stack trace for system errors', (done) => {
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at ...';

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            'Request failed',
            expect.objectContaining({
              stack: expect.stringContaining('Database connection failed'),
            }),
          );
          done();
        },
      });
    });

    it('should log request headers when available', (done) => {
      mockRequest.headers = {
        'user-agent': 'Test Agent',
        'x-api-key': 'secret-key',
      };

      const error = new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address',
      );

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          expect(loggerSpy).toHaveBeenCalledWith(
            'Request failed',
            expect.objectContaining({
              headers: expect.objectContaining({
                'user-agent': 'Test Agent',
                'x-api-key': 'secret-key',
              }),
            }),
          );
          done();
        },
      });
    });
  });

  describe('error response format', () => {
    it('should include timestamp in ISO format', (done) => {
      const error = new ValidationError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address',
      );

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          const jsonCall = mockResponse.json.mock.calls[0][0];
          expect(jsonCall.timestamp).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          );
          done();
        },
      });
    });

    it('should exclude sensitive error details in production', (done) => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error(
        'Database connection string: postgresql://user:pass@host',
      );

      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          const jsonCall = mockResponse.json.mock.calls[0][0];
          expect(jsonCall.error.message).toBe('Internal server error');
          expect(jsonCall.error.details).toBeUndefined();

          process.env.NODE_ENV = originalEnv;
          done();
        },
      });
    });
  });
});
