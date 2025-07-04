# Thirdweb Authentication Module

This module implements authentication using Thirdweb Wallet JWT tokens following Clean Architecture principles.

## Overview

The authentication module validates JWT tokens issued by Thirdweb and manages users in the system. It provides:

- Thirdweb JWT token validation
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
THIRDWEB_CLIENT_ID=your_thirdweb_client_id_here
THIRDWEB_SECRET_KEY=your_thirdweb_secret_key_here

```

### 2. Database

The users table will be created automatically when the application starts.

## How to Use

### Protecting Routes

Use the `ThirdwebAuthGuard` to protect routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ThirdwebAuthGuard } from '../auth/interface/guards/thirdweb-auth.guard';
import { CurrentUser } from '../auth/interface/decorators/current-user.decorator';
import { UserEntity } from '../auth/domain/entities/user.entity';

@Controller('protected')
export class ProtectedController {

  @Get('data')
  @UseGuards(ThirdwebAuthGuard)
  async getProtectedData(@CurrentUser() user: UserEntity) {
    return {
      message: 'Protected data',
      userId: user.id,
      thirdwebId: user.thirdwebId,
      walletAddress: user.walletAddress
    };
  }
}
```

### Getting the Current User

Use the `@CurrentUser()` decorator to get the authenticated user:

```typescript
@Get('profile')
@UseGuards(ThirdwebAuthGuard)
async getProfile(@CurrentUser() user: UserEntity) {
  return user.toJSON();
}
```

### Frontend - Sending Tokens

The frontend should send the Thirdweb token in the Authorization header:

```typescript
// Frontend (React/Next.js)
import { useActiveWallet } from '@thirdweb-dev/react';

const wallet = useActiveWallet();
const getAccessToken = async () => {
  if (!wallet) throw new Error('No wallet connected');
  return await wallet.signMessage('auth-message');
};

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

1. **Frontend**: User logs in via Thirdweb
2. **Frontend**: Gets access token from Thirdweb
3. **Frontend**: Sends token to backend
4. **Backend**: Receives token in Authorization header
5. **Backend**: Validates token with Thirdweb
6. **Backend**: Finds user in database
7. **Backend**: Attaches user to request
8. **Backend**: Allows access to protected route

## Available Endpoints

### GET /auth/profile
Returns the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <thirdweb_token>
```

**Response:**
```json
{
  "id": "uuid",
  "thirdwebId": "thirdweb_id",
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
Authorization: Bearer <thirdweb_token>
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

To test protected routes, you'll need a valid Thirdweb token. In development environment, you can:

1. Set up a test Thirdweb app
2. Use the frontend to get valid tokens
3. Implement mocks for unit tests

## Security

- Tokens are validated using Thirdweb's official library
- Cryptographic signature verification
- Token expiration validation
- App ID verification to prevent cross-app attacks
- Inactive users are automatically rejected