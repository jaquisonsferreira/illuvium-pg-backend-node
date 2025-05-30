import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';

function getParamDecoratorFactory(
  decorator: (...args: any[]) => ParameterDecorator,
) {
  class TestDecorator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public test(@decorator() _value: any) {}
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestDecorator, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser Decorator', () => {
  const mockUser = new UserEntity({
    id: '123e4567-e89b-12d3-a456-426614174000',
    privyId: 'privy_123',
    nickname: 'testuser',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
    isActive: true,
  });

  const createMockExecutionContext = (user?: UserEntity): ExecutionContext => {
    const mockRequest = {
      user,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  it('should extract user from request', () => {
    const context = createMockExecutionContext(mockUser);
    const factory = getParamDecoratorFactory(CurrentUser);

    const result = factory(undefined, context);

    expect(result).toBe(mockUser);
    expect(result).toBeInstanceOf(UserEntity);
  });

  it('should return undefined when no user in request', () => {
    const context = createMockExecutionContext();
    const factory = getParamDecoratorFactory(CurrentUser);

    const result = factory(undefined, context);

    expect(result).toBeUndefined();
  });

  it('should work with different user instances', () => {
    const anotherUser = new UserEntity({
      id: 'another-id',
      privyId: 'another-privy-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: false,
    });

    const context = createMockExecutionContext(anotherUser);
    const factory = getParamDecoratorFactory(CurrentUser);

    const result = factory(undefined, context);

    expect(result).toBe(anotherUser);
    expect(result.id).toBe('another-id');
    expect(result.privyId).toBe('another-privy-id');
    expect(result.isActive).toBe(false);
  });

  it('should ignore data parameter', () => {
    const context = createMockExecutionContext(mockUser);
    const factory = getParamDecoratorFactory(CurrentUser);

    const result = factory('some-data', context);

    expect(result).toBe(mockUser);
  });
});
