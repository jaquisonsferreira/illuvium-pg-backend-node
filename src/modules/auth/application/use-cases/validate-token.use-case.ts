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
  internalError?: string;
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
        const internalError =
          tokenValidationResult.error || 'Token validation failed';
        console.error('Token validation failed:', internalError);
        return {
          isValid: false,
          internalError,
        };
      }

      const domainValidationResult =
        this.tokenValidationService.validateTokenClaims(
          tokenValidationResult.claims,
          request.appId,
        );

      if (!domainValidationResult.isValid || !domainValidationResult.claims) {
        const internalError =
          domainValidationResult.error || 'Claims validation failed';
        console.error('Claims validation failed:', internalError);
        return {
          isValid: false,
          internalError,
        };
      }

      const user = await this.userRepository.findByPrivyId(
        domainValidationResult.claims.getUserId,
      );

      if (!user) {
        console.error(
          'User not found for privy ID:',
          domainValidationResult.claims.getUserId,
        );
        return {
          isValid: false,
          internalError: 'User not found',
        };
      }

      if (!user.isActive) {
        console.error(
          'User account is inactive for privy ID:',
          domainValidationResult.claims.getUserId,
        );
        return {
          isValid: false,
          internalError: 'User account is inactive',
        };
      }

      return {
        isValid: true,
        user,
      };
    } catch (error) {
      const internalError =
        error instanceof Error ? error.message : 'Token validation failed';
      console.error('Token validation error:', internalError);
      return {
        isValid: false,
        internalError,
      };
    }
  }
}
