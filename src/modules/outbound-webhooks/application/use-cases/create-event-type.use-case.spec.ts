import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateEventTypeUseCase,
  CreateEventTypeDto,
} from './create-event-type.use-case';
import { SvixService, SvixEventType } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

describe('CreateEventTypeUseCase', () => {
  let useCase: CreateEventTypeUseCase;
  let svixService: jest.Mocked<SvixService>;

  beforeEach(async () => {
    const mockSvixService = {
      createEventType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateEventTypeUseCase,
        {
          provide: SVIX_SERVICE,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<CreateEventTypeUseCase>(CreateEventTypeUseCase);
    svixService = module.get<jest.Mocked<SvixService>>(SVIX_SERVICE);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create event type successfully', async () => {
    const dto: CreateEventTypeDto = {
      name: 'user.created',
      description: 'User creation event',
    };

    const expectedEventType: SvixEventType = {
      name: 'user.created',
      description: 'User creation event',
      archived: false,
    };

    svixService.createEventType.mockResolvedValue(expectedEventType);

    const result = await useCase.execute(dto);

    expect(svixService.createEventType).toHaveBeenCalledWith(
      dto.name,
      dto.description,
    );
    expect(result).toEqual(expectedEventType);
  });

  it('should create event type without description', async () => {
    const dto: CreateEventTypeDto = {
      name: 'user.updated',
    };

    const expectedEventType: SvixEventType = {
      name: 'user.updated',
      archived: false,
    };

    svixService.createEventType.mockResolvedValue(expectedEventType);

    const result = await useCase.execute(dto);

    expect(svixService.createEventType).toHaveBeenCalledWith(
      dto.name,
      undefined,
    );
    expect(result).toEqual(expectedEventType);
  });

  it('should propagate error from svix service', async () => {
    const dto: CreateEventTypeDto = {
      name: 'user.created',
      description: 'User creation event',
    };

    const error = new Error('Svix API error');
    svixService.createEventType.mockRejectedValue(error);

    await expect(useCase.execute(dto)).rejects.toThrow('Svix API error');
    expect(svixService.createEventType).toHaveBeenCalledWith(
      dto.name,
      dto.description,
    );
  });
});
