import { Inject } from '@nestjs/common';

export function InjectQueue(queueName: string): ParameterDecorator {
  return Inject(`BullQueue_${queueName}`);
}
