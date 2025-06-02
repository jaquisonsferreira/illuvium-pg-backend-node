import { Global, Module } from '@nestjs/common';
import { createDatabaseConnection } from './index';
import { RepositoryFactory } from './repositories/repository.factory';
import { DATABASE_CONNECTION } from './constants';
import { EnvironmentConfigService } from '../config';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (config: EnvironmentConfigService) =>
        createDatabaseConnection(config),
      inject: [EnvironmentConfigService],
    },
    {
      provide: RepositoryFactory,
      useFactory: (connection) => new RepositoryFactory(connection),
      inject: [DATABASE_CONNECTION],
    },
  ],
  exports: [DATABASE_CONNECTION, RepositoryFactory],
})
export class DatabaseModule {}
