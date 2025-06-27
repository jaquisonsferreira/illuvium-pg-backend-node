import { Test, TestingModule } from '@nestjs/testing';
import {
  DeleteEventTypeUseCase,
  DeleteEventTypeDto,
} from './delete-event-type.use-case';
import { SvixService } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

describe('DeleteEventTypeUseCase', () => {
  let useCase: DeleteEventTypeUseCase;
  let svixService: jest.Mocked<SvixService>;

  beforeEach(async () => {
    const mockSvixService = {
      deleteEventType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteEventTypeUseCase,
        {
          provide: SVIX_SERVICE,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<DeleteEventTypeUseCase>(DeleteEventTypeUseCase);
    svixService = module.get<jest.Mocked<SvixService>>(SVIX_SERVICE);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should delete event type successfully', async () => {
    const dto: DeleteEventTypeDto = {
      name: 'user.created',
    };

    svixService.deleteEventType.mockResolvedValue();

    await useCase.execute(dto);

    expect(svixService.deleteEventType).toHaveBeenCalledWith(dto.name);
  });

  it('should propagate error from svix service', async () => {
    const dto: DeleteEventTypeDto = {
      name: 'user.created',
    };

    const error = new Error('Svix API error');
    svixService.deleteEventType.mockRejectedValue(error);

    await expect(useCase.execute(dto)).rejects.toThrow('Svix API error');
    expect(svixService.deleteEventType).toHaveBeenCalledWith(dto.name);
  });
});
