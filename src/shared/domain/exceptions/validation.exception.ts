import { HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BaseException, ErrorResponseProps } from './base.exception';

export class ValidationException extends BaseException {
  constructor(
    message: string,
    errors: ValidationError[] | Record<string, any>,
    code = 'VALIDATION_ERROR',
  ) {
    const errorDetails = Array.isArray(errors)
      ? transformValidationErrors(errors)
      : errors;

    const props: ErrorResponseProps = {
      message,
      code,
      details: { errors: errorDetails },
    };

    super(props, HttpStatus.BAD_REQUEST);
  }
}

/**
 * Transforms validation errors from class-validator into a more friendly structure
 */
function transformValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const error of errors) {
    const propertyPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      result[propertyPath] = Object.values(error.constraints);
    }

    if (error.children && error.children.length > 0) {
      const childErrors = transformValidationErrors(
        error.children,
        propertyPath,
      );
      Object.assign(result, childErrors);
    }
  }

  return result;
}
