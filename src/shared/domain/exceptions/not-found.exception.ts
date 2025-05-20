import { HttpStatus } from '@nestjs/common';
import { BaseException, ErrorResponseProps } from './base.exception';

export class NotFoundException extends BaseException {
  constructor(
    message: string,
    entityId?: string | number,
    entityType?: string,
    code = 'RESOURCE_NOT_FOUND',
  ) {
    const props: ErrorResponseProps = {
      message,
      code,
      details: entityId ? { entityId, entityType } : undefined,
    };

    super(props, HttpStatus.NOT_FOUND);
  }
}
