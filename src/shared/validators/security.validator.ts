import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';
import { Logger } from '@nestjs/common';

export interface SecurityValidationOptions {
  maxRequestSize?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
  allowedContentTypes?: string[];
  blockPatterns?: RegExp[];
}

export class SecurityValidator {
  private static readonly logger = new Logger(SecurityValidator.name);

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b\s+.*\b(from|into|where|table)\b)/i,
    /(--|#|\/\*|\*\/|xp_|sp_)/i,
    /(\bor\b\s+.*=|=.*\bor\b)/i,
    /(\band\b\s+.*=|=.*\band\b)/i,
    /('|")\s*;\s*(drop|delete|update|insert)/i,
    /('|")\s+(or|and)\s+('|")\d*\s*=\s*('|")\d*/i,
  ];

  private static readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /\bon\w+\s*=/gi,
    /<img[^>]*onerror\s*=/gi,
    /<\w+[^>]*\son\w+\s*=/gi,
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[\/\\]/,
    /\.\.%2[fF]/,
    /\.\.%5[cC]/,
  ];

  static validateRequestPatterns(
    input: any,
    fieldName: string = 'input',
  ): void {
    const stringValue =
      typeof input === 'string' ? input : JSON.stringify(input);

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(stringValue)) {
        this.logger.warn(
          `Potential SQL injection detected in ${fieldName}: ${stringValue.substring(0, 100)}`,
        );
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Request contains invalid patterns',
          {
            field: fieldName,
            reason: 'Potentially harmful patterns detected',
          },
        );
      }
    }

    // Check for XSS patterns
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(stringValue)) {
        this.logger.warn(
          `Potential XSS detected in ${fieldName}: ${stringValue.substring(0, 100)}`,
        );
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Request contains invalid HTML/JavaScript',
          {
            field: fieldName,
            reason: 'HTML or JavaScript content not allowed',
          },
        );
      }
    }

    // Check for path traversal patterns
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(stringValue)) {
        this.logger.warn(
          `Potential path traversal detected in ${fieldName}: ${stringValue.substring(0, 100)}`,
        );
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          'Request contains invalid path patterns',
          {
            field: fieldName,
            reason: 'Path traversal patterns not allowed',
          },
        );
      }
    }
  }

  static validateRequestSize(
    data: any,
    maxSizeBytes: number = 1048576, // 1MB default
  ): void {
    const size = Buffer.byteLength(JSON.stringify(data));

    if (size > maxSizeBytes) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Request payload too large',
        {
          size_bytes: size,
          max_size_bytes: maxSizeBytes,
          max_size_mb: (maxSizeBytes / 1048576).toFixed(2),
        },
      );
    }
  }

  static validateArrayLength(
    array: any[],
    maxLength: number,
    fieldName: string = 'array',
  ): void {
    if (!Array.isArray(array)) {
      return;
    }

    if (array.length > maxLength) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        `Too many items in ${fieldName}`,
        {
          provided_length: array.length,
          max_length: maxLength,
          field: fieldName,
        },
      );
    }
  }

  static validateNoEmptyValues(
    obj: Record<string, any>,
    allowedEmptyFields: string[] = [],
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      if (allowedEmptyFields.includes(key)) {
        continue;
      }

      if (
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        throw new ValidationError(
          ErrorCodes.INVALID_PARAMS,
          `Field ${key} cannot be empty`,
          {
            field: key,
            value: value,
          },
        );
      }
    }
  }

  static validateContentType(
    contentType: string | undefined,
    allowedTypes: string[] = ['application/json'],
  ): void {
    if (!contentType) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Content-Type header is required',
        {
          allowed_types: allowedTypes,
        },
      );
    }

    const normalizedType = contentType.toLowerCase().split(';')[0].trim();

    if (!allowedTypes.includes(normalizedType)) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Invalid Content-Type',
        {
          provided_type: normalizedType,
          allowed_types: allowedTypes,
        },
      );
    }
  }

  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove control characters except tabs and newlines
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  static validateApiKey(
    apiKey: string | undefined,
    pattern: RegExp = /^[a-zA-Z0-9\-_]{32,128}$/,
  ): string {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'API key is required',
        {
          header: 'x-api-key',
        },
      );
    }

    if (!pattern.test(apiKey)) {
      throw new ValidationError(
        ErrorCodes.INVALID_PARAMS,
        'Invalid API key format',
        {
          reason: 'API key does not match expected format',
        },
      );
    }

    return apiKey;
  }

  static detectSuspiciousPatterns(request: {
    ip?: string;
    userAgent?: string;
    referer?: string;
    body?: any;
  }): void {
    // Check for missing or suspicious user agent
    if (!request.userAgent || request.userAgent.length < 10) {
      this.logger.warn(
        `Suspicious request: Missing or invalid user agent from IP ${request.ip}`,
      );
    }

    // Check for suspicious referer
    if (request.referer && this.isSuspiciousReferer(request.referer)) {
      this.logger.warn(
        `Suspicious request: Invalid referer ${request.referer} from IP ${request.ip}`,
      );
    }

    // Check for automated patterns in request body
    if (request.body && this.hasAutomatedPatterns(request.body)) {
      this.logger.warn(
        `Suspicious request: Automated patterns detected from IP ${request.ip}`,
      );
    }
  }

  private static isSuspiciousReferer(referer: string): boolean {
    const suspiciousPatterns = [
      /^https?:\/\/localhost/i,
      /^https?:\/\/127\.0\.0\.1/i,
      /^https?:\/\/0\.0\.0\.0/i,
      /\.local$/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(referer));
  }

  private static hasAutomatedPatterns(body: any): boolean {
    const stringBody = JSON.stringify(body);

    // Check for sequential patterns (e.g., test1, test2, test3)
    const sequentialPattern = /test\d+|user\d+|wallet\d+/gi;
    const matches = stringBody.match(sequentialPattern);

    if (matches && matches.length > 3) {
      return true;
    }

    // Check for repeated values
    const values = this.extractValues(body);
    const valueCounts = new Map<string, number>();

    for (const value of values) {
      if (typeof value === 'string' && value.length > 5) {
        valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
      }
    }

    // If any value appears more than 5 times, it might be automated
    for (const count of valueCounts.values()) {
      if (count > 5) {
        return true;
      }
    }

    return false;
  }

  private static extractValues(obj: any, values: any[] = []): any[] {
    if (obj === null || obj === undefined) {
      return values;
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          this.extractValues(item, values);
        }
      } else {
        for (const value of Object.values(obj)) {
          this.extractValues(value, values);
        }
      }
    } else {
      values.push(obj);
    }

    return values;
  }
}
