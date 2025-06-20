import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  DEVELOPER_API_KEY_REPOSITORY,
  DEVELOPER_NFT_OPERATION_REPOSITORY,
} from './constants';

import { CreateApiKeyUseCase } from './application/use-cases/create-api-key.use-case';
import { ValidateApiKeyUseCase } from './application/use-cases/validate-api-key.use-case';
import { MintNftUseCase } from './application/use-cases/mint-nft.use-case';
import { BurnNftUseCase } from './application/use-cases/burn-nft.use-case';
import { TransferNftUseCase } from './application/use-cases/transfer-nft.use-case';
import { UpdateNftMetadataUseCase } from './application/use-cases/update-nft-metadata.use-case';
import { CreateSaleUseCase } from './application/use-cases/create-sale.use-case';

import { DeveloperApiKeyRepository } from './infrastructure/database/developer-api-key.repository';
import { DeveloperNftOperationRepository } from './infrastructure/database/developer-nft-operation.repository';

import { ApiKeysController } from './interface/controllers/api-keys.controller';
import { DeveloperNftController } from './interface/controllers/developer-nft.controller';
import { ApiKeyGuard } from './interface/guards/api-key.guard';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ApiKeysController, DeveloperNftController],
  providers: [
    CreateApiKeyUseCase,
    ValidateApiKeyUseCase,
    MintNftUseCase,
    BurnNftUseCase,
    TransferNftUseCase,
    UpdateNftMetadataUseCase,
    CreateSaleUseCase,
    ApiKeyGuard,
    {
      provide: DEVELOPER_API_KEY_REPOSITORY,
      useClass: DeveloperApiKeyRepository,
    },
    {
      provide: DEVELOPER_NFT_OPERATION_REPOSITORY,
      useClass: DeveloperNftOperationRepository,
    },
  ],
  exports: [
    ValidateApiKeyUseCase,
    DEVELOPER_API_KEY_REPOSITORY,
    DEVELOPER_NFT_OPERATION_REPOSITORY,
  ],
})
export class DeveloperModule {}
