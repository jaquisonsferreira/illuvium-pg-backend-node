import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateApiKeyUseCase } from '../../application/use-cases/create-api-key.use-case';
import { CreateApiKeyDto } from '../dtos/create-api-key.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('API Keys')
@Controller('developer/api-keys')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private readonly createApiKeyUseCase: CreateApiKeyUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createApiKey(
    @Body() createApiKeyDto: CreateApiKeyDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    const apiKey = await this.createApiKeyUseCase.execute({
      ...createApiKeyDto,
      userId,
      expiresAt: createApiKeyDto.expiresAt
        ? new Date(createApiKeyDto.expiresAt)
        : undefined,
    });

    return {
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
      permissions: apiKey.permissions,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }
}
