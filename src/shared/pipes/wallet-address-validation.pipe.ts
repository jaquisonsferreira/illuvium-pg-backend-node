import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { WalletAddressValidator } from '@shared/validators/wallet-address.validator';

@Injectable()
export class WalletAddressValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'param' && metadata.type !== 'query') {
      return value;
    }

    return WalletAddressValidator.validate(value);
  }
}

@Injectable()
export class OptionalWalletAddressValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'param' && metadata.type !== 'query') {
      return value;
    }

    return WalletAddressValidator.validateOptional(value);
  }
}
