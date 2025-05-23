import { Injectable, Inject } from '@nestjs/common';
import { UserRepositoryInterface } from '../../domain/repositories/user.repository.interface';
import { TokenValidationDomainService } from '../../domain/services/token-validation.domain-service';
import { UserEntity } from '../../domain/entities/user.entity';
import { PrivyTokenValidationService } from '../../infrastructure/services/privy-token-validation.service';
import { USER_REPOSITORY_TOKEN } from '../../constants';

export interface ValidateTokenRequest {
  token: string;
  appId: string;
}

export interface ValidateTokenResponse {
  isValid: boolean;
  user?: UserEntity;
  error?: string;
}

@Injectable()
export class ValidateTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepositoryInterface,
    private readonly tokenValidationService: TokenValidationDomainService,
    private readonly privyTokenValidationService: PrivyTokenValidationService,
  ) {}

  async execute(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      const tokenValidationResult =
        await this.privyTokenValidationService.validateToken(request.token);

      if (!tokenValidationResult.isValid || !tokenValidationResult.claims) {
        return {
          isValid: false,
          error: tokenValidationResult.error || 'Token validation failed',
        };
      }

      const domainValidationResult =
        this.tokenValidationService.validateTokenClaims(
          tokenValidationResult.claims,
          request.appId,
        );

      if (!domainValidationResult.isValid || !domainValidationResult.claims) {
        return {
          isValid: false,
          error: domainValidationResult.error || 'Claims validation failed',
        };
      }

      const user = await this.userRepository.findByPrivyId(
        domainValidationResult.claims.getUserId,
      );

      if (!user) {
        return {
          isValid: false,
          error: 'User not found',
        };
      }

      if (!user.isActive) {
        return {
          isValid: false,
          error: 'User account is inactive',
        };
      }

      return {
        isValid: true,
        user,
      };
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }
}
