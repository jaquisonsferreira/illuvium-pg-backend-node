import { Global, Module } from '@nestjs/common';
import { AuthController } from './interface/controllers/auth.controller';
import { ValidateTokenUseCase } from './application/use-cases/validate-token.use-case';
import { ManageLinkedAccountsUseCase } from './application/use-cases/manage-linked-accounts.use-case';
import { TokenValidationDomainService } from './domain/services/token-validation.domain-service';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { LinkedAccountRepository } from './infrastructure/repositories/linked-account.repository';
import { PrivyTokenValidationService } from './infrastructure/services/privy-token-validation.service';
import { PrivyAuthGuard } from './interface/guards/privy-auth.guard';
import {
  USER_REPOSITORY_TOKEN,
  LINKED_ACCOUNT_REPOSITORY_TOKEN,
} from './constants';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    // Use Cases
    ValidateTokenUseCase,
    ManageLinkedAccountsUseCase,

    // Domain Services
    TokenValidationDomainService,

    // Infrastructure Services
    PrivyTokenValidationService,

    // Repositories
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserRepository,
    },
    {
      provide: LINKED_ACCOUNT_REPOSITORY_TOKEN,
      useClass: LinkedAccountRepository,
    },

    // Guards
    PrivyAuthGuard,
  ],
  exports: [
    PrivyAuthGuard,
    ValidateTokenUseCase,
    ManageLinkedAccountsUseCase,
    USER_REPOSITORY_TOKEN,
    LINKED_ACCOUNT_REPOSITORY_TOKEN,
  ],
})
export class AuthModule {}
