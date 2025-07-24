import { Module } from '@nestjs/common';
import { CronExpression } from '../decorators/cron.decorator';

@Module({
  providers: [],
  exports: [],
})
export class ScheduleModule {
  static forRoot() {
    return {
      module: ScheduleModule,
      providers: [],
      exports: [],
    };
  }
}

export { CronExpression };
