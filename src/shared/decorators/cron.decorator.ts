export function Cron(cronExpression: string): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    // Stub implementation
    return descriptor;
  };
}

export enum CronExpression {
  EVERY_DAY_AT_1AM = '0 1 * * *',
  EVERY_DAY_AT_2AM = '0 2 * * *',
  EVERY_DAY_AT_3AM = '0 3 * * *',
  EVERY_HOUR = '0 * * * *',
  EVERY_6_HOURS = '0 */6 * * *',
  EVERY_12_HOURS = '0 */12 * * *',
  EVERY_30_MINUTES = '*/30 * * * *',
  EVERY_10_MINUTES = '*/10 * * * *',
  EVERY_5_MINUTES = '*/5 * * * *',
  EVERY_MINUTE = '* * * * *',
}
