import { Global, Module } from '@nestjs/common';
import { db } from './index';
import { RepositoryFactory } from './repositories/repository.factory';
import { DATABASE_CONNECTION } from './constants';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useValue: db,
    },
    {
      provide: RepositoryFactory,
      useFactory: () => new RepositoryFactory(db),
    },
  ],
  exports: [DATABASE_CONNECTION, RepositoryFactory],
})
export class DatabaseModule {}
