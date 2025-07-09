import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateSvixEndpointUseCase,
  CreateSvixEndpointDto,
} from './create-svix-endpoint.use-case';
import { SvixService, SvixEndpoint } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';
import { WebhookEventType } from '../../domain/entities/webhook-subscription.entity';

describe('CreateSvixEndpointUseCase', () => {
  let useCase: CreateSvixEndpointUseCase;
  let svixService: jest.Mocked<SvixService>;

  beforeEach(async () => {
    const mockSvixService = {
      createEndpoint: jest.fn(),
      createApplication: jest.fn(),
      deleteEndpoint: jest.fn(),
      sendMessage: jest.fn(),
      updateEndpoint: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateSvixEndpointUseCase,
        {
          provide: SVIX_SERVICE,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<CreateSvixEndpointUseCase>(CreateSvixEndpointUseCase);
    svixService = module.get(SVIX_SERVICE);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create a Svix endpoint successfully', async () => {
    const dto: CreateSvixEndpointDto = {
      applicationId: 'app-123',
      url: 'https://test.com/webhook',
      eventTypes: [WebhookEventType.NFT_MINT, WebhookEventType.NFT_TRANSFER],
    };

    const expectedEndpoint: SvixEndpoint = {
      id: 'endpoint-123',
      url: 'https://test.com/webhook',
      eventTypes: ['NFT_MINTED', 'NFT_TRANSFERRED'],
    };

    svixService.createEndpoint.mockResolvedValue(expectedEndpoint);

    const result = await useCase.execute(dto);

    expect(svixService.createEndpoint).toHaveBeenCalledWith(
      dto.applicationId,
      dto.url,
      dto.eventTypes,
    );
    expect(result).toEqual(expectedEndpoint);
  });

  it('should throw error when Svix service fails', async () => {
    const dto: CreateSvixEndpointDto = {
      applicationId: 'app-123',
      url: 'https://test.com/webhook',
      eventTypes: [WebhookEventType.NFT_MINT],
    };

    const error = new Error('Svix API error');
    svixService.createEndpoint.mockRejectedValue(error);

    await expect(useCase.execute(dto)).rejects.toThrow('Svix API error');
  });
});
