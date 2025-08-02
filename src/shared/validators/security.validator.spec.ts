import { SecurityValidator } from './security.validator';
import { ValidationError, ErrorCodes } from '@shared/errors/validation.error';

describe('SecurityValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('validateRequestPatterns', () => {
    describe('SQL Injection Detection', () => {
      it('should detect SQL injection patterns', () => {
        const maliciousInputs = [
          "'; DROP TABLE users; --",
          "1' OR '1'='1",
          "admin' --",
          "' UNION SELECT * FROM passwords --",
          '1 AND 1=1',
          '1 OR 1=1',
        ];

        maliciousInputs.forEach((input) => {
          expect(() =>
            SecurityValidator.validateRequestPatterns(input, 'testField'),
          ).toThrow(ValidationError);
        });
      });

      it('should allow safe SQL-like strings', () => {
        const safeInputs = [
          'This is a normal comment about unions',
          'I selected this item from the dropdown',
          'unionize',
          'selection',
        ];

        safeInputs.forEach((input) => {
          expect(() =>
            SecurityValidator.validateRequestPatterns(input, 'testField'),
          ).not.toThrow();
        });
      });
    });

    describe('XSS Detection', () => {
      it('should detect XSS patterns', () => {
        const xssInputs = [
          '<script>alert("XSS")</script>',
          '<iframe src="malicious.com"></iframe>',
          'javascript:alert(1)',
          '<img src=x onerror=alert(1)>',
          '<div onclick="alert(1)">click</div>',
        ];

        xssInputs.forEach((input) => {
          expect(() =>
            SecurityValidator.validateRequestPatterns(input, 'testField'),
          ).toThrow(ValidationError);
        });
      });

      it('should allow safe HTML-like strings', () => {
        const safeInputs = [
          'The price is < $100',
          'a > b',
          'Use <Enter> to submit',
          'My email is user@javascript.com',
        ];

        safeInputs.forEach((input) => {
          expect(() =>
            SecurityValidator.validateRequestPatterns(input, 'testField'),
          ).not.toThrow();
        });
      });
    });

    describe('Path Traversal Detection', () => {
      it('should detect path traversal patterns', () => {
        const pathTraversalInputs = [
          '../../../etc/passwd',
          '..\\..\\windows\\system32',
          '..%2F..%2Fetc%2Fpasswd',
          '..%5C..%5Cwindows',
        ];

        pathTraversalInputs.forEach((input) => {
          expect(() =>
            SecurityValidator.validateRequestPatterns(input, 'testField'),
          ).toThrow(ValidationError);
        });
      });

      it('should allow safe path-like strings', () => {
        const safeInputs = [
          'folder/file.txt',
          'my-file...txt',
          'version.1.2.3',
          'file..name',
        ];

        safeInputs.forEach((input) => {
          expect(() =>
            SecurityValidator.validateRequestPatterns(input, 'testField'),
          ).not.toThrow();
        });
      });
    });

    it('should validate objects by stringifying them', () => {
      const maliciousObject = {
        query: "'; DROP TABLE users; --",
      };

      expect(() =>
        SecurityValidator.validateRequestPatterns(
          maliciousObject,
          'testObject',
        ),
      ).toThrow(ValidationError);
    });

    it('should include field name in error', () => {
      try {
        SecurityValidator.validateRequestPatterns("' OR 1=1", 'userInput');
      } catch (error) {
        expect(error.details.field).toBe('userInput');
      }
    });
  });

  describe('validateRequestSize', () => {
    it('should allow requests within size limit', () => {
      const smallData = { message: 'Hello' };

      expect(() =>
        SecurityValidator.validateRequestSize(smallData, 1048576),
      ).not.toThrow();
    });

    it('should throw error for oversized requests', () => {
      const largeData = { data: 'x'.repeat(1048577) };

      expect(() =>
        SecurityValidator.validateRequestSize(largeData, 1048576),
      ).toThrow(ValidationError);
    });

    it('should calculate size correctly for complex objects', () => {
      const data = {
        users: Array(1000).fill({
          name: 'John Doe',
          email: 'john@example.com',
          address: '123 Main Street, Anytown, USA',
        }),
      };

      expect(() => SecurityValidator.validateRequestSize(data, 50000)).toThrow(
        ValidationError,
      );
    });

    it('should include size details in error', () => {
      const data = { data: 'x'.repeat(2000) };

      try {
        SecurityValidator.validateRequestSize(data, 1000);
      } catch (error) {
        expect(error.details.size_bytes).toBeGreaterThan(2000);
        expect(error.details.max_size_bytes).toBe(1000);
        expect(error.details.max_size_mb).toBe('0.00');
      }
    });
  });

  describe('validateArrayLength', () => {
    it('should allow arrays within length limit', () => {
      const array = [1, 2, 3, 4, 5];

      expect(() =>
        SecurityValidator.validateArrayLength(array, 10, 'items'),
      ).not.toThrow();
    });

    it('should throw error for arrays exceeding limit', () => {
      const array = Array(101).fill(0);

      expect(() =>
        SecurityValidator.validateArrayLength(array, 100, 'items'),
      ).toThrow(ValidationError);
    });

    it('should skip validation for non-arrays', () => {
      expect(() =>
        SecurityValidator.validateArrayLength('not-array' as any, 10, 'items'),
      ).not.toThrow();
    });

    it('should include array length details in error', () => {
      const array = Array(150).fill(0);

      try {
        SecurityValidator.validateArrayLength(array, 100, 'items');
      } catch (error) {
        expect(error.details.provided_length).toBe(150);
        expect(error.details.max_length).toBe(100);
        expect(error.details.field).toBe('items');
      }
    });
  });

  describe('validateNoEmptyValues', () => {
    it('should validate object with no empty values', () => {
      const obj = {
        name: 'John',
        age: 30,
        active: true,
      };

      expect(() => SecurityValidator.validateNoEmptyValues(obj)).not.toThrow();
    });

    it('should throw error for null values', () => {
      const obj = { name: 'John', email: null };

      expect(() => SecurityValidator.validateNoEmptyValues(obj)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for undefined values', () => {
      const obj = { name: 'John', email: undefined };

      expect(() => SecurityValidator.validateNoEmptyValues(obj)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for empty strings', () => {
      const obj = { name: 'John', email: '' };

      expect(() => SecurityValidator.validateNoEmptyValues(obj)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for whitespace-only strings', () => {
      const obj = { name: 'John', email: '   ' };

      expect(() => SecurityValidator.validateNoEmptyValues(obj)).toThrow(
        ValidationError,
      );
    });

    it('should allow empty values in allowed fields', () => {
      const obj = { name: 'John', optional: '', required: 'value' };

      expect(() =>
        SecurityValidator.validateNoEmptyValues(obj, ['optional']),
      ).not.toThrow();
    });

    it('should include field name in error', () => {
      const obj = { name: 'John', email: null };

      try {
        SecurityValidator.validateNoEmptyValues(obj);
      } catch (error) {
        expect(error.details.field).toBe('email');
        expect(error.details.value).toBe(null);
      }
    });
  });

  describe('validateContentType', () => {
    it('should validate allowed content types', () => {
      expect(() =>
        SecurityValidator.validateContentType('application/json'),
      ).not.toThrow();
    });

    it('should throw error for missing content type', () => {
      expect(() => SecurityValidator.validateContentType(undefined)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for disallowed content types', () => {
      expect(() => SecurityValidator.validateContentType('text/html')).toThrow(
        ValidationError,
      );
    });

    it('should normalize content type by removing charset', () => {
      expect(() =>
        SecurityValidator.validateContentType(
          'application/json; charset=utf-8',
        ),
      ).not.toThrow();
    });

    it('should validate custom allowed types', () => {
      const allowedTypes = ['application/json', 'application/xml'];

      expect(() =>
        SecurityValidator.validateContentType('application/xml', allowedTypes),
      ).not.toThrow();
    });

    it('should include allowed types in error', () => {
      try {
        SecurityValidator.validateContentType('text/html', [
          'application/json',
        ]);
      } catch (error) {
        expect(error.details.provided_type).toBe('text/html');
        expect(error.details.allowed_types).toEqual(['application/json']);
      }
    });
  });

  describe('sanitizeString', () => {
    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1F';
      const result = SecurityValidator.sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should preserve tabs and newlines', () => {
      const input = 'Hello\tWorld\nNew Line';
      const result = SecurityValidator.sanitizeString(input);
      expect(result).toBe('Hello\tWorld\nNew Line');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = SecurityValidator.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should limit string length', () => {
      const input = 'a'.repeat(2000);
      const result = SecurityValidator.sanitizeString(input, 100);
      expect(result.length).toBe(100);
    });

    it('should handle non-string inputs', () => {
      expect(SecurityValidator.sanitizeString(null as any)).toBe('');
      expect(SecurityValidator.sanitizeString(undefined as any)).toBe('');
      expect(SecurityValidator.sanitizeString(123 as any)).toBe('');
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key format', () => {
      const apiKey = 'abcdef123456789012345678901234567890';
      const result = SecurityValidator.validateApiKey(apiKey);
      expect(result).toBe(apiKey);
    });

    it('should throw error for missing API key', () => {
      expect(() => SecurityValidator.validateApiKey(undefined)).toThrow(
        ValidationError,
      );
    });

    it('should throw error for invalid format', () => {
      expect(() => SecurityValidator.validateApiKey('too-short')).toThrow(
        ValidationError,
      );
    });

    it('should validate with custom pattern', () => {
      const customPattern = /^sk-[a-zA-Z0-9]{48}$/;
      const apiKey = 'sk-abcdef123456789012345678901234567890123456789012';

      const result = SecurityValidator.validateApiKey(apiKey, customPattern);
      expect(result).toBe(apiKey);
    });

    it('should throw error for keys with invalid characters', () => {
      const apiKey = 'abcdef!@#$%^&*()1234567890123456';

      expect(() => SecurityValidator.validateApiKey(apiKey)).toThrow(
        ValidationError,
      );
    });
  });

  describe('detectSuspiciousPatterns', () => {
    it('should detect missing user agent', () => {
      const logSpy = jest.spyOn(SecurityValidator['logger'], 'warn');

      SecurityValidator.detectSuspiciousPatterns({
        ip: '192.168.1.1',
        userAgent: undefined,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing or invalid user agent'),
      );
    });

    it('should detect suspicious referer', () => {
      const logSpy = jest.spyOn(SecurityValidator['logger'], 'warn');

      SecurityValidator.detectSuspiciousPatterns({
        ip: '192.168.1.1',
        referer: 'http://localhost:3000',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid referer'),
      );
    });

    it('should detect automated patterns in body', () => {
      const logSpy = jest.spyOn(SecurityValidator['logger'], 'warn');

      SecurityValidator.detectSuspiciousPatterns({
        ip: '192.168.1.1',
        body: {
          users: ['test1', 'test2', 'test3', 'test4', 'test5'],
        },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Automated patterns detected'),
      );
    });

    it('should not flag legitimate requests', () => {
      const logSpy = jest.spyOn(SecurityValidator['logger'], 'warn');

      SecurityValidator.detectSuspiciousPatterns({
        ip: '192.168.1.1',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        referer: 'https://example.com',
        body: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      });

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
