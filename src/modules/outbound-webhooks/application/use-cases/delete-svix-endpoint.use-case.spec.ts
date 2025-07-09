import { Test, TestingModule } from '@nestjs/testing';
import {
  DeleteSvixEndpointUseCase,
  DeleteSvixEndpointDto,
} from './delete-svix-endpoint.use-case';
import { SvixService } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

describe('DeleteSvixEndpointUseCase', () => {
  let useCase: DeleteSvixEndpointUseCase;
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
        DeleteSvixEndpointUseCase,
        {
          provide: SVIX_SERVICE,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<DeleteSvixEndpointUseCase>(DeleteSvixEndpointUseCase);
    svixService = module.get(SVIX_SERVICE);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should delete a Svix endpoint successfully', async () => {
    const dto: DeleteSvixEndpointDto = {
      applicationId: 'app-123',
      endpointId: 'endpoint-123',
    };

    svixService.deleteEndpoint.mockResolvedValue(undefined);

    await useCase.execute(dto);

    expect(svixService.deleteEndpoint).toHaveBeenCalledWith(
      dto.applicationId,
      dto.endpointId,
    );
  });

  it('should throw error when Svix service fails', async () => {
    const dto: DeleteSvixEndpointDto = {
      applicationId: 'app-123',
      endpointId: 'endpoint-123',
    };

    const error = new Error('Svix API error');
    svixService.deleteEndpoint.mockRejectedValue(error);

    await expect(useCase.execute(dto)).rejects.toThrow('Svix API error');
  });
});
