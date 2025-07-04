import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ThirdwebAuthGuard } from '../guards/thirdweb-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import {
  ManageLinkedAccountsUseCase,
  LinkAccountRequest,
} from '../../application/use-cases/manage-linked-accounts.use-case';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly manageLinkedAccountsUseCase: ManageLinkedAccountsUseCase,
  ) {}
  @Get('profile')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: UserEntity) {
    return {
      id: user.id,
      thirdwebId: user.thirdwebId,
      walletAddress: user.walletAddress,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      experiments: user.experiments,
      socialBluesky: user.socialBluesky,
      socialDiscord: user.socialDiscord,
      socialInstagram: user.socialInstagram,
      socialFarcaster: user.socialFarcaster,
      socialTwitch: user.socialTwitch,
      socialYoutube: user.socialYoutube,
      socialX: user.socialX,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Get('linked-accounts')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all linked accounts for current user' })
  @ApiResponse({
    status: 200,
    description: 'Linked accounts retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLinkedAccounts(@CurrentUser() user: UserEntity) {
    const result = await this.manageLinkedAccountsUseCase.getLinkedAccounts({
      userId: user.id,
    });

    if (!result.success) {
      throw new Error('Unauthorized');
    }

    return {
      linkedAccounts: result.linkedAccounts,
    };
  }

  @Get('linked-accounts/wallets')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wallet accounts for current user' })
  @ApiResponse({
    status: 200,
    description: 'Wallet accounts retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWalletAccounts(@CurrentUser() user: UserEntity) {
    const result = await this.manageLinkedAccountsUseCase.getWalletAccounts({
      userId: user.id,
    });

    if (!result.success) {
      throw new Error('Unauthorized');
    }

    return {
      walletAccounts: result.linkedAccounts,
    };
  }

  @Get('linked-accounts/email')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get email account for current user' })
  @ApiResponse({
    status: 200,
    description: 'Email account retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getEmailAccount(@CurrentUser() user: UserEntity) {
    const result = await this.manageLinkedAccountsUseCase.getEmailAccount({
      userId: user.id,
    });

    if (!result.success) {
      throw new Error('Unauthorized');
    }

    return {
      emailAccount: result.linkedAccount,
    };
  }

  @Post('linked-accounts')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a new account to current user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'wallet' },
        identifier: { type: 'string', example: '0x1234...' },
        emailAddress: { type: 'string', example: 'user@example.com' },
        label: { type: 'string', example: 'Primary Wallet' },
      },
      required: ['type', 'identifier'],
    },
  })
  @ApiResponse({ status: 201, description: 'Account linked successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async linkAccount(
    @CurrentUser() user: UserEntity,
    @Body() body: Omit<LinkAccountRequest, 'userId'>,
  ) {
    const result = await this.manageLinkedAccountsUseCase.linkAccount({
      userId: user.id,
      ...body,
    });

    if (!result.success) {
      throw new Error('Unauthorized');
    }

    return {
      message: 'Account linked successfully',
      linkedAccount: result.linkedAccount,
    };
  }

  @Delete('linked-accounts/:type/:identifier')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink an account from current user' })
  @ApiResponse({ status: 204, description: 'Account unlinked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unlinkAccount(
    @CurrentUser() user: UserEntity,
    @Param('type') type: string,
    @Param('identifier') identifier: string,
  ) {
    const result = await this.manageLinkedAccountsUseCase.unlinkAccount({
      userId: user.id,
      type,
      identifier,
    });

    if (!result.success) {
      throw new Error('Unauthorized');
    }

    return;
  }

  @Get('protected')
  @UseGuards(ThirdwebAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Protected route example' })
  @ApiResponse({ status: 200, description: 'Access granted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async protectedRoute(@CurrentUser() user: UserEntity) {
    return {
      message: 'This is a protected route',
      userId: user.id,
      timestamp: new Date().toISOString(),
    };
  }
}
