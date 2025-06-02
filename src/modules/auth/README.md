# Privy Authentication Module

This module implements authentication using Privy Wallet JWT tokens following Clean Architecture principles.

## Overview

The authentication module validates JWT tokens issued by Privy and manages users in the system. It provides:

- Privy JWT token validation
- Route protection via Guards
- Authenticated user management
- Integration with Clean Architecture

## Structure

```
auth/
├── domain/                 # Business rules
│   ├── entities/          # Domain entities
│   ├── repositories/      # Repository interfaces
│   ├── services/          # Domain services
│   └── value-objects/     # Value objects
├── application/           # Use cases
│   └── use-cases/         # Application use cases
├── infrastructure/        # Technical implementations
│   ├── repositories/      # Repository implementations
│   └── services/          # Infrastructure services
└── interface/             # Interface layer
    ├── controllers/       # REST controllers
    ├── decorators/        # Custom decorators
    └── guards/            # Authentication guards
```

## Configuration

### 1. Environment Variables

Add the following variables to your `.env` file:

```env
PRIVY_APP_ID=your_privy_app_id_here
PRIVY_APP_SECRET=your_privy_app_secret_here

```

### 2. Database

The users table will be created automatically when the application starts.

## How to Use

### Protecting Routes

Use the `PrivyAuthGuard` to protect routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrivyAuthGuard } from '../auth/interface/guards/privy-auth.guard';
import { CurrentUser } from '../auth/interface/decorators/current-user.decorator';
import { UserEntity } from '../auth/domain/entities/user.entity';

@Controller('protected')
export class ProtectedController {

  @Get('data')
  @UseGuards(PrivyAuthGuard)
  async getProtectedData(@CurrentUser() user: UserEntity) {
    return {
      message: 'Protected data',
      userId: user.id,
      privyId: user.privyId
    };
  }
}
```

### Getting the Current User

Use the `@CurrentUser()` decorator to get the authenticated user:

```typescript
@Get('profile')
@UseGuards(PrivyAuthGuard)
async getProfile(@CurrentUser() user: UserEntity) {
  return user.toJSON();
}
```

### Frontend - Sending Tokens

The frontend should send the Privy token in the Authorization header:

```typescript
// Frontend (React/Next.js)
import { usePrivy } from '@privy-io/react-auth';

const { getAccessToken } = usePrivy();

const makeAuthenticatedRequest = async () => {
  const token = await getAccessToken();

  const response = await fetch('/api/protected/data', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.json();
};
```

## Authentication Flow

1. **Frontend**: User logs in via Privy
2. **Frontend**: Gets access token from Privy
3. **Frontend**: Sends token in Authorization header
4. **Backend**: Guard intercepts the request
5. **Backend**: Validates token with Privy
6. **Backend**: Finds user in database
7. **Backend**: Attaches user to request
8. **Backend**: Allows access to protected route

## Available Endpoints

### GET /auth/profile
Returns the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <privy_token>
```

**Response:**
```json
{
  "id": "uuid",
  "privyId": "did:privy:...",
  "walletAddress": "0x...",
  "email": "user@example.com",
  "phoneNumber": "+1234567890",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /auth/protected
Example protected route.

**Headers:**
```
Authorization: Bearer <privy_token>
```

**Response:**
```json
{
  "message": "This is a protected route",
  "userId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The module returns the following HTTP errors:

- **401 Unauthorized**: Invalid, expired, or missing token
- **401 Unauthorized**: User not found
- **401 Unauthorized**: Inactive user account

## Extensibility

### Adding New User Fields

1. Update the `UserProps` interface in `user.entity.ts`
2. Update the `UserTable` interface in `database.types.ts`
3. Create a new migration to alter the table
4. Update the repository as needed

### Adding Custom Validations

Implement validations in the `TokenValidationDomainService` or create new domain services.

## Testing

To test protected routes, you'll need a valid Privy token. In development environment, you can:

1. Set up a test Privy app
2. Use the frontend to get valid tokens
3. Implement mocks for unit tests

## Security

- Tokens are validated using Privy's official library
- Cryptographic signature verification
- Token expiration validation
- App ID verification to prevent cross-app attacks
- Inactive users are automatically rejected