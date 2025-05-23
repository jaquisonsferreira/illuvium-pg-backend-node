/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrivyAuthGuard } from './privy-auth.guard';
import { ValidateTokenUseCase } from '../../application/use-cases/validate-token.use-case';
import { UserEntity } from '../../domain/entities/user.entity';

describe('PrivyAuthGuard', () => {
  let guard: PrivyAuthGuard;
  let validateTokenUseCase: jest.Mocked<ValidateTokenUseCase>;

  const mockUser = new UserEntity({
    id: '123e4567-e89b-12d3-a456-426614174000',
    privyId: 'privy_123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    isActive: true,
  });

  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.PRIVY_APP_ID = 'test-app-id';

    const mockValidateTokenUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivyAuthGuard,
        {
          provide: ValidateTokenUseCase,
          useValue: mockValidateTokenUseCase,
        },
      ],
    }).compile();

    guard = module.get<PrivyAuthGuard>(PrivyAuthGuard);
    validateTokenUseCase = module.get(ValidateTokenUseCase);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    authHeader?: string,
  ): ExecutionContext => {
    const mockRequest = {
      headers: {
        authorization: authHeader,
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should return true for valid token', async () => {
      const context = createMockExecutionContext('Bearer valid-token');

      validateTokenUseCase.execute.mockResolvedValue({
        isValid: true,
        user: mockUser,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(validateTokenUseCase.execute).toHaveBeenCalledWith({
        token: 'valid-token',
        appId: 'test-app-id',
      });
      expect(context.switchToHttp().getRequest().user).toBe(mockUser);
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );

      expect(validateTokenUseCase.execute).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when authorization header is malformed', async () => {
      const context = createMockExecutionContext('InvalidHeader');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );

      expect(validateTokenUseCase.execute).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token type is not Bearer', async () => {
      const context = createMockExecutionContext('Basic token123');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );

      expect(validateTokenUseCase.execute).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when PRIVY_APP_ID is not configured', async () => {
      delete process.env.PRIVY_APP_ID;
      const context = createMockExecutionContext('Bearer valid-token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Authentication service not configured'),
      );

      expect(validateTokenUseCase.execute).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token validation fails', async () => {
      const context = createMockExecutionContext('Bearer invalid-token');

      validateTokenUseCase.execute.mockResolvedValue({
        isValid: false,
        error: 'Token has expired',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token has expired'),
      );

      expect(validateTokenUseCase.execute).toHaveBeenCalledWith({
        token: 'invalid-token',
        appId: 'test-app-id',
      });
    });

    it('should throw UnauthorizedException with default message when validation fails without error', async () => {
      const context = createMockExecutionContext('Bearer invalid-token');

      validateTokenUseCase.execute.mockResolvedValue({
        isValid: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );
    });

    it('should handle empty authorization header', async () => {
      const context = createMockExecutionContext('');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );
    });

    it('should handle authorization header with only Bearer', async () => {
      const context = createMockExecutionContext('Bearer');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );
    });

    it('should handle authorization header with extra spaces', async () => {
      const context = createMockExecutionContext('Bearer   valid-token');

      validateTokenUseCase.execute.mockResolvedValue({
        isValid: true,
        user: mockUser,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(validateTokenUseCase.execute).toHaveBeenCalledWith({
        token: 'valid-token',
        appId: 'test-app-id',
      });
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer authorization header', async () => {
      const context = createMockExecutionContext('Bearer test-token');

      validateTokenUseCase.execute.mockResolvedValue({
        isValid: true,
        user: mockUser,
      });

      await guard.canActivate(context);

      expect(validateTokenUseCase.execute).toHaveBeenCalledWith({
        token: 'test-token',
        appId: 'test-app-id',
      });
    });

    it('should return undefined for missing authorization header', async () => {
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );
    });

    it('should return undefined for non-Bearer token type', async () => {
      const context = createMockExecutionContext('Basic dGVzdDp0ZXN0');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );
    });
  });
});
