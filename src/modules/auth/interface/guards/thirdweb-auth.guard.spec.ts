import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ThirdwebAuthGuard } from './thirdweb-auth.guard';
import { ValidateTokenUseCase } from '../../application/use-cases/validate-token.use-case';
import { UserEntity } from '../../domain/entities/user.entity';

// Helper function to create mock UserEntity
const createMockUser = (overrides: Partial<any> = {}): UserEntity => {
  const mockProps = {
    id: 'user-123',
    thirdwebId: 'thirdweb-user-123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return {
    ...mockProps,
    get id() {
      return mockProps.id;
    },
    get thirdwebId() {
      return mockProps.thirdwebId;
    },
    get walletAddress() {
      return mockProps.walletAddress;
    },
    get isActive() {
      return mockProps.isActive;
    },
    get createdAt() {
      return mockProps.createdAt;
    },
    get updatedAt() {
      return mockProps.updatedAt;
    },
  } as UserEntity;
};

describe('ThirdwebAuthGuard', () => {
  let guard: ThirdwebAuthGuard;
  let mockValidateTokenUseCase: jest.Mocked<ValidateTokenUseCase>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    mockValidateTokenUseCase = {
      execute: jest.fn(),
    } as any;

    mockRequest = {
      headers: {},
      user: undefined,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    guard = new ThirdwebAuthGuard(mockValidateTokenUseCase);
  });

  describe('canActivate', () => {
    it('should return true for valid token', async () => {
      const token = 'valid-jwt-token';
      mockRequest.headers.authorization = `Bearer ${token}`;

      const mockUser = createMockUser();

      mockValidateTokenUseCase.execute.mockResolvedValue({
        isValid: true,
        user: mockUser,
      });

      process.env.THIRDWEB_CLIENT_ID = 'test-client-id';

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockValidateTokenUseCase.execute).toHaveBeenCalledWith({
        token,
        clientId: 'test-client-id',
      });
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      mockRequest.headers.authorization = undefined;

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );
    });

    it('should throw UnauthorizedException when authorization header is malformed', async () => {
      mockRequest.headers.authorization = 'InvalidHeader';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );
    });

    it('should throw UnauthorizedException when THIRDWEB_CLIENT_ID is not configured', async () => {
      const token = 'valid-jwt-token';
      mockRequest.headers.authorization = `Bearer ${token}`;

      delete process.env.THIRDWEB_CLIENT_ID;

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication service not configured'),
      );
    });

    it('should throw UnauthorizedException when token validation fails', async () => {
      const token = 'invalid-jwt-token';
      mockRequest.headers.authorization = `Bearer ${token}`;

      mockValidateTokenUseCase.execute.mockResolvedValue({
        isValid: false,
        user: undefined,
      });

      process.env.THIRDWEB_CLIENT_ID = 'test-client-id';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired access token'),
      );
    });

    it('should handle Bearer token with extra whitespace', async () => {
      const token = 'valid-jwt-token';
      mockRequest.headers.authorization = `Bearer   ${token}`;

      const mockUser = createMockUser();

      mockValidateTokenUseCase.execute.mockResolvedValue({
        isValid: true,
        user: mockUser,
      });

      process.env.THIRDWEB_CLIENT_ID = 'test-client-id';

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for non-Bearer tokens', async () => {
      mockRequest.headers.authorization = 'Basic dXNlcjpwYXNz';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Access token is required'),
      );
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const request = {
        headers: {
          authorization: 'Bearer valid-token-123',
        },
      };

      const token = (guard as any).extractTokenFromHeader(request);

      expect(token).toBe('valid-token-123');
    });

    it('should return undefined for missing authorization header', () => {
      const request = {
        headers: {},
      };

      const token = (guard as any).extractTokenFromHeader(request);

      expect(token).toBeUndefined();
    });

    it('should return undefined for malformed authorization header', () => {
      const request = {
        headers: {
          authorization: 'InvalidHeader',
        },
      };

      const token = (guard as any).extractTokenFromHeader(request);

      expect(token).toBeUndefined();
    });

    it('should handle multiple whitespace characters', () => {
      const request = {
        headers: {
          authorization: 'Bearer    token-with-spaces',
        },
      };

      const token = (guard as any).extractTokenFromHeader(request);

      expect(token).toBe('token-with-spaces');
    });
  });

  afterEach(() => {
    delete process.env.THIRDWEB_CLIENT_ID;
  });
});
