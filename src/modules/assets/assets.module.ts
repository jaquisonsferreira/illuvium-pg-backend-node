import { Module } from '@nestjs/common';
import { AssetsController } from './interface/controllers/assets.controller';
import { CreateAssetUseCase } from './application/use-cases/create-asset.use-case';
import { AssetRepository } from './infrastructure/database/asset.repository';
import { ASSET_REPOSITORY } from './constants';

@Module({
  controllers: [AssetsController],
  providers: [
    CreateAssetUseCase,
    {
      provide: ASSET_REPOSITORY,
      useClass: AssetRepository,
    },
  ],
  exports: [ASSET_REPOSITORY, CreateAssetUseCase],
})
export class AssetsModule {}
