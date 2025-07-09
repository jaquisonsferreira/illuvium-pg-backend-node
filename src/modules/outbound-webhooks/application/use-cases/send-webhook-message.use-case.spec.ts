import { Test, TestingModule } from '@nestjs/testing';
import {
  SendWebhookMessageUseCase,
  SendWebhookMessageDto,
} from './send-webhook-message.use-case';
import { SvixService } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

describe('SendWebhookMessageUseCase', () => {
  let useCase: SendWebhookMessageUseCase;
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
        SendWebhookMessageUseCase,
        {
          provide: SVIX_SERVICE,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<SendWebhookMessageUseCase>(SendWebhookMessageUseCase);
    svixService = module.get(SVIX_SERVICE);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should send a webhook message successfully', async () => {
    const dto: SendWebhookMessageDto = {
      applicationId: 'app-123',
      eventType: 'NFT_MINTED',
      payload: {
        tokenId: '12345',
        to: '0x1234567890abcdef',
        contractAddress: '0xabcdef1234567890',
      },
    };

    svixService.sendMessage.mockResolvedValue(undefined);

    await useCase.execute(dto);

    expect(svixService.sendMessage).toHaveBeenCalledWith(dto.applicationId, {
      eventType: dto.eventType,
      payload: dto.payload,
    });
  });

  it('should throw error when Svix service fails', async () => {
    const dto: SendWebhookMessageDto = {
      applicationId: 'app-123',
      eventType: 'NFT_MINTED',
      payload: { tokenId: '12345' },
    };

    const error = new Error('Svix API error');
    svixService.sendMessage.mockRejectedValue(error);

    await expect(useCase.execute(dto)).rejects.toThrow('Svix API error');
  });
});
