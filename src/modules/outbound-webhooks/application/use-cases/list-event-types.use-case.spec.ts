import { Test, TestingModule } from '@nestjs/testing';
import { ListEventTypesUseCase } from './list-event-types.use-case';
import { SvixService, SvixEventType } from '../services/svix.service';
import { SVIX_SERVICE } from '../../constants';

describe('ListEventTypesUseCase', () => {
  let useCase: ListEventTypesUseCase;
  let svixService: jest.Mocked<SvixService>;

  beforeEach(async () => {
    const mockSvixService = {
      listEventTypes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEventTypesUseCase,
        {
          provide: SVIX_SERVICE,
          useValue: mockSvixService,
        },
      ],
    }).compile();

    useCase = module.get<ListEventTypesUseCase>(ListEventTypesUseCase);
    svixService = module.get<jest.Mocked<SvixService>>(SVIX_SERVICE);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should list event types successfully', async () => {
    const expectedEventTypes: SvixEventType[] = [
      {
        name: 'user.created',
        description: 'User creation event',
        archived: false,
      },
      {
        name: 'user.updated',
        description: 'User update event',
        archived: false,
      },
      {
        name: 'user.deleted',
        archived: true,
      },
    ];

    svixService.listEventTypes.mockResolvedValue(expectedEventTypes);

    const result = await useCase.execute();

    expect(svixService.listEventTypes).toHaveBeenCalledWith();
    expect(result).toEqual(expectedEventTypes);
  });

  it('should return empty array when no event types exist', async () => {
    svixService.listEventTypes.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(svixService.listEventTypes).toHaveBeenCalledWith();
    expect(result).toEqual([]);
  });

  it('should propagate error from svix service', async () => {
    const error = new Error('Svix API error');
    svixService.listEventTypes.mockRejectedValue(error);

    await expect(useCase.execute()).rejects.toThrow('Svix API error');
    expect(svixService.listEventTypes).toHaveBeenCalledWith();
  });
});
