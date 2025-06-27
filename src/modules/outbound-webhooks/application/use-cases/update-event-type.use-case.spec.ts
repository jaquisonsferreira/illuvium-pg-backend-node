import { Test, TestingModule } from '@nestjs/testing';
import {
  UpdateEventTypeUseCase,
  UpdateEventTypeDto,
} from './update-event-type.use-case';
import { SvixService, SvixEventType } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

describe('UpdateEventTypeUseCase', () => {
  let useCase: UpdateEventTypeUseCase;
  let svixService: jest.Mocked<SvixService>;

  beforeEach(async () => {
    const mockSvixService = {
      updateEventType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateEventTypeUseCase,
        {
          provide: SVIX_SERVICE,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<UpdateEventTypeUseCase>(UpdateEventTypeUseCase);
    svixService = module.get<jest.Mocked<SvixService>>(SVIX_SERVICE);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should update event type successfully', async () => {
    const dto: UpdateEventTypeDto = {
      name: 'user.created',
      description: 'Updated user creation event',
      archived: false,
    };

    const expectedEventType: SvixEventType = {
      name: 'user.created',
      description: 'Updated user creation event',
      archived: false,
    };

    svixService.updateEventType.mockResolvedValue(expectedEventType);

    const result = await useCase.execute(dto);

    expect(svixService.updateEventType).toHaveBeenCalledWith(
      dto.name,
      dto.description,
      dto.archived,
    );
    expect(result).toEqual(expectedEventType);
  });

  it('should update event type with partial data', async () => {
    const dto: UpdateEventTypeDto = {
      name: 'user.updated',
      archived: true,
    };

    const expectedEventType: SvixEventType = {
      name: 'user.updated',
      archived: true,
    };

    svixService.updateEventType.mockResolvedValue(expectedEventType);

    const result = await useCase.execute(dto);

    expect(svixService.updateEventType).toHaveBeenCalledWith(
      dto.name,
      undefined,
      dto.archived,
    );
    expect(result).toEqual(expectedEventType);
  });

  it('should propagate error from svix service', async () => {
    const dto: UpdateEventTypeDto = {
      name: 'user.created',
      description: 'Updated description',
    };

    const error = new Error('Svix API error');
    svixService.updateEventType.mockRejectedValue(error);

    await expect(useCase.execute(dto)).rejects.toThrow('Svix API error');
    expect(svixService.updateEventType).toHaveBeenCalledWith(
      dto.name,
      dto.description,
      undefined,
    );
  });
});
