# 🚀 Cache Service - Valkey

This cache service was implemented following **Clean Architecture** principles and uses **Valkey** (open-source Redis fork) as storage backend.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [Practical Examples](#practical-examples)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **🏗️ Clean Architecture**: Clear separation between domain, application and infrastructure
- **🔄 Type-Safe**: Fully typed with TypeScript
- **⚡ High Performance**: Uses Valkey GLIDE for maximum performance
- **🔧 Configurable**: Flexible configuration via environment variables
- **📦 Namespaces**: Data organization with namespaces
- **⏰ TTL Support**: Complete Time-To-Live support
- **🔍 Pattern Matching**: Search by key patterns
- **📊 Batch Operations**: Batch operations for efficiency
- **🎯 Memoization**: Automatic function caching
- **💊 Health Checks**: Cache health monitoring

## 🏛️ Architecture

```
src/shared/
├── domain/cache/                    # Domain Layer
│   ├── cache-key.value-object.ts    # Value Object for keys
│   ├── cache-value.value-object.ts  # Value Object for values
│   ├── cache.entity.ts              # Cache Entity
│   └── repositories/                # Repository Interfaces
├── application/cache/               # Application Layer
│   ├── use-cases/                   # Use Cases
│   ├── dtos/                        # Data Transfer Objects
│   └── cache.service.ts             # Main Service
└── infrastructure/cache/            # Infrastructure Layer
    ├── config/                      # Configurations
    ├── repositories/                # Implementations
    └── cache.module.ts              # NestJS Module
```

## ⚙️ Configuration

### Environment Variables

```bash
# Valkey/Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DATABASE=0
REDIS_KEY_PREFIX=illuvium:
REDIS_DEFAULT_TTL=3600
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000
REDIS_USE_TLS=false
REDIS_CLIENT_NAME=illuvium-api
```

### Installation

```bash
# Install dependencies
npm install @valkey/valkey-glide

# Module is already configured in AppModule
```

## 🚀 Basic Usage

### Service Injection

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '@shared/application/cache/cache.service';

@Injectable()
export class UserService {
  constructor(private readonly cacheService: CacheService) {}

  async getUser(id: number) {
    // Try to get from cache first
    const cached = await this.cacheService.get<User>(`user:${id}`);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const user = await this.userRepository.findById(id);

    // Store in cache for 1 hour
    await this.cacheService.set(`user:${id}`, user, 3600);

    return user;
  }
}
```

### Basic Operations

```typescript
// Set value
await cacheService.set('key', { data: 'value' }, 3600);

// Get value
const value = await cacheService.get<MyType>('key');

// Check existence
const exists = await cacheService.has('key');

// Delete
const deleted = await cacheService.delete('key');

// Increment counter
const count = await cacheService.increment('counter', 1);
```

## 🔥 Advanced Features

### Namespaces

```typescript
// Organize data by namespace
await cacheService.set('profile', userData, 3600, 'user:123');
await cacheService.set('settings', userSettings, 3600, 'user:123');

// Clear entire namespace
await cacheService.clearNamespace('user:123');
```

### Batch Operations

```typescript
// Set multiple values
await cacheService.setMultiple([
  { key: 'item1', value: data1, ttl: 3600 },
  { key: 'item2', value: data2, ttl: 3600 },
], 'namespace');

// Get multiple values
const items = await cacheService.getMultiple(['item1', 'item2'], 'namespace');
```

### Memoization

```typescript
// Automatic function caching
const result = await cacheService.remember(
  'expensive_operation',
  async () => {
    // Expensive operation
    return await performExpensiveOperation();
  },
  3600 // TTL
);
```

### Pattern Search

```typescript
// Search keys by pattern
const userKeys = await cacheService.getKeys('user:*');

// Get values by pattern
const userData = await cacheService.getWithPattern('user:*');
```

## 📚 Practical Examples

### User Session Cache

```typescript
@Injectable()
export class SessionService {
  constructor(private readonly cacheService: CacheService) {}

  async createSession(userId: number, sessionData: SessionData) {
    const sessionId = generateSessionId();

    await this.cacheService.set(
      sessionId,
      { userId, ...sessionData, createdAt: new Date() },
      86400, // 24 hours
      'sessions'
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return this.cacheService.get<SessionData>(sessionId, 'sessions');
  }

  async invalidateSession(sessionId: string): Promise<boolean> {
    return this.cacheService.delete(sessionId, 'sessions');
  }
}
```

### Rate Limiting Cache

```typescript
@Injectable()
export class RateLimitService {
  constructor(private readonly cacheService: CacheService) {}

  async checkRateLimit(userId: number, limit: number = 100): Promise<boolean> {
    const key = `rate_limit:${userId}`;
    const current = await this.cacheService.get<number>(key) || 0;

    if (current >= limit) {
      return false; // Rate limit exceeded
    }

    await this.cacheService.increment(key, 1);

    // Set TTL only on first request
    if (current === 0) {
      await this.cacheService.set(key, 1, 3600); // Reset every hour
    }

    return true;
  }
}
```

### External API Data Cache

```typescript
@Injectable()
export class ExternalApiService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly httpService: HttpService,
  ) {}

  async getExternalData(endpoint: string): Promise<any> {
    return this.cacheService.remember(
      `external_api:${endpoint}`,
      async () => {
        const response = await this.httpService.get(endpoint).toPromise();
        return response.data;
      },
      1800 // Cache for 30 minutes
    );
  }
}
```

## 📖 API Reference

### CacheService

#### Main Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `set<T>(key, value, ttl?, namespace?)` | Sets a value in cache | key: string, value: T, ttl?: number, namespace?: string |
| `get<T>(key, namespace?)` | Gets a value from cache | key: string, namespace?: string |
| `delete(key, namespace?)` | Removes a key from cache | key: string, namespace?: string |
| `has(key, namespace?)` | Checks if a key exists | key: string, namespace?: string |
| `clear()` | Clears entire cache | - |
| `ping()` | Tests connectivity | - |

#### Counter Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `increment(key, value?, namespace?)` | Increments a counter | key: string, value?: number, namespace?: string |
| `decrement(key, value?, namespace?)` | Decrements a counter | key: string, value?: number, namespace?: string |

#### Batch Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `setMultiple(entries, namespace?)` | Sets multiple values | entries: Array<{key, value, ttl?}>, namespace?: string |
| `getMultiple(keys, namespace?)` | Gets multiple values | keys: string[], namespace?: string |
| `deleteMultiple(keys, namespace?)` | Removes multiple keys | keys: string[], namespace?: string |

#### Search Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `getKeys(pattern, namespace?)` | Search keys by pattern | pattern: string, namespace?: string |
| `getWithPattern(pattern, namespace?)` | Get values by pattern | pattern: string, namespace?: string |

#### Memoization Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `remember(key, fn, ttl?, namespace?)` | Cache with function | key: string, fn: () => Promise<T>, ttl?: number, namespace?: string |
| `wrap(fn, key, ttl?, namespace?)` | Function wrapper | fn: () => Promise<T>, key: string, ttl?: number, namespace?: string |
| `rememberForever(key, fn, namespace?)` | Permanent cache | key: string, fn: () => Promise<T>, namespace?: string |

#### Monitoring Methods

| Method | Description | Return |
|--------|-------------|---------|
| `getHealth()` | Cache health status | `Promise<CacheHealthDto>` |
| `ping()` | Connectivity test | `Promise<string>` |

## 🔧 Troubleshooting

### Common Issues

#### 1. Connection Error

```bash
Error: Failed to connect to Valkey
```

**Solution**: Check if Valkey is running and configurations are correct.

```bash
# Check if Valkey is running
docker ps | grep valkey

# Test manual connection
telnet localhost 6379
```

#### 2. Serialization Error

```bash
Error: Failed to deserialize cache value
```

**Solution**: Verify that stored data is JSON serializable.

```typescript
// ❌ Doesn't work - functions are not serializable
await cacheService.set('key', { fn: () => {} });

// ✅ Works - simple data
await cacheService.set('key', { data: 'value', number: 123 });
```

#### 3. TTL Not Working

**Solution**: Verify that TTL is being passed correctly.

```typescript
// ❌ TTL not defined - data stays permanent
await cacheService.set('key', value);

// ✅ TTL defined - data expires
await cacheService.set('key', value, 3600);
```

### Monitoring

```typescript
// Check cache health
const health = await cacheService.getHealth();
console.log('Cache Status:', health.status);
console.log('Response Time:', health.responseTime, 'ms');

// Connectivity test
try {
  const pong = await cacheService.ping();
  console.log('Cache is responsive:', pong === 'PONG');
} catch (error) {
  console.error('Cache is not responding:', error.message);
}
```

### Performance Tips

1. **Use appropriate TTL**: Don't leave data in cache indefinitely
2. **Use namespaces**: Organize data to facilitate cleanup
3. **Batch operations**: Use `setMultiple`/`getMultiple` for multiple operations
4. **Memoization**: Use `remember` for automatic caching of expensive functions
5. **Key patterns**: Use consistent patterns to facilitate search

---

## 🎯 Next Steps (TODO if needed)

- [ ] Implement distributed cache for multiple instances
- [ ] Add performance metrics
- [ ] Implement cache warming
- [ ] Add hierarchical cache support
- [ ] Implement intelligent cache invalidation
