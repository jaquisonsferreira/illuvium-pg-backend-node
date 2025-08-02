import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { AmountValidator } from '@shared/validators/amount.validator';

@Injectable()
export class AmountValidationPipe implements PipeTransform {
  constructor(private readonly tokenDecimals: number) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    const validatedAmount = AmountValidator.validateRawAmount(value, {
      tokenDecimals: this.tokenDecimals,
      allowZero: false,
    });

    return validatedAmount.toString();
  }
}

@Injectable()
export class DisplayAmountValidationPipe implements PipeTransform {
  constructor(private readonly tokenDecimals: number) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    return AmountValidator.validateDisplayAmount(value, this.tokenDecimals);
  }
}
