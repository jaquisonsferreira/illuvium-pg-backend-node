import { Test, TestingModule } from '@nestjs/testing';
import { GitHubVerificationService } from './github-verification.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('GitHubVerificationService', () => {
  let service: GitHubVerificationService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-github-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubVerificationService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GitHubVerificationService>(GitHubVerificationService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  describe('verifyPullRequest', () => {
    it('should verify a merged pull request', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          number: 123,
          user: {
            login: 'developer',
            email: 'dev@example.com',
          },
          title: 'Fix authentication bug',
          state: 'closed',
          merged: true,
          merged_at: '2024-01-10T10:00:00Z',
          created_at: '2024-01-09T10:00:00Z',
          html_url: 'https://github.com/org/repo/pull/123',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.verifyPullRequest('org', 'repo', '123');

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/org/repo/pulls/123',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: 'Bearer test-github-token',
          },
        },
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe('pull_request');
      expect(result?.id).toBe('123');
      expect(result?.author).toBe('developer');
      expect(result?.status).toBe('merged');
      expect(result?.mergedAt).toEqual(new Date('2024-01-10T10:00:00Z'));
    });

    it('should verify an open pull request', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          number: 456,
          user: {
            login: 'contributor',
            email: null,
          },
          title: 'Add new feature',
          state: 'open',
          merged: false,
          merged_at: null,
          created_at: '2024-01-15T10:00:00Z',
          html_url: 'https://github.com/org/repo/pull/456',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.verifyPullRequest('org', 'repo', '456');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('open');
      expect(result?.mergedAt).toBeUndefined();
      expect(result?.authorEmail).toBe('');
    });

    it('should handle API errors', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.verifyPullRequest('org', 'repo', '999');

      expect(result).toBeNull();
    });

    it('should work without API token', async () => {
      configService.get.mockReturnValue(undefined);

      const newModule = await Test.createTestingModule({
        providers: [
          GitHubVerificationService,
          {
            provide: HttpService,
            useValue: httpService,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceNoToken = newModule.get<GitHubVerificationService>(
        GitHubVerificationService,
      );

      const mockResponse: AxiosResponse = {
        data: {
          number: 789,
          user: { login: 'user' },
          title: 'Test PR',
          state: 'open',
          merged: false,
          created_at: '2024-01-20T10:00:00Z',
          html_url: 'https://github.com/org/repo/pull/789',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      await serviceNoToken.verifyPullRequest('org', 'repo', '789');

      expect(httpService.get).toHaveBeenCalledWith(expect.any(String), {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });
    });
  });

  describe('verifyCommit', () => {
    it('should verify a commit', async () => {
      const mockCommitResponse: AxiosResponse = {
        data: {
          sha: 'abc123def456',
          author: {
            login: 'developer',
          },
          commit: {
            author: {
              name: 'Developer',
              email: 'dev@example.com',
              date: '2024-01-10T10:00:00Z',
            },
            message: 'Fix critical bug\n\nDetailed description',
          },
          html_url: 'https://github.com/org/repo/commit/abc123def456',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockBranchesResponse: AxiosResponse = {
        data: [{ name: 'main' }, { name: 'develop' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get
        .mockReturnValueOnce(of(mockCommitResponse))
        .mockReturnValueOnce(of(mockBranchesResponse));

      const result = await service.verifyCommit('org', 'repo', 'abc123def456');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('commit');
      expect(result?.id).toBe('abc123def456');
      expect(result?.author).toBe('developer');
      expect(result?.authorEmail).toBe('dev@example.com');
      expect(result?.title).toBe('Fix critical bug');
      expect(result?.status).toBe('merged');
    });

    it('should handle commit without author login', async () => {
      const mockCommitResponse: AxiosResponse = {
        data: {
          sha: 'def789ghi012',
          author: null,
          commit: {
            author: {
              name: 'Anonymous Developer',
              email: 'anon@example.com',
              date: '2024-01-11T10:00:00Z',
            },
            message: 'Update readme',
          },
          html_url: 'https://github.com/org/repo/commit/def789ghi012',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockBranchesResponse: AxiosResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get
        .mockReturnValueOnce(of(mockCommitResponse))
        .mockReturnValueOnce(of(mockBranchesResponse));

      const result = await service.verifyCommit('org', 'repo', 'def789ghi012');

      expect(result?.author).toBe('Anonymous Developer');
      expect(result?.status).toBe('open');
    });

    it('should handle API errors', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.verifyCommit('org', 'repo', 'invalid');

      expect(result).toBeNull();
    });
  });

  describe('isCommitInMainBranch', () => {
    it('should return true for commit in main branch', async () => {
      const mockResponse: AxiosResponse = {
        data: [{ name: 'main' }, { name: 'feature-branch' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.isCommitInMainBranch(
        'org',
        'repo',
        'abc123',
      );

      expect(result).toBe(true);
    });

    it('should return true for commit in master branch', async () => {
      const mockResponse: AxiosResponse = {
        data: [{ name: 'master' }, { name: 'develop' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.isCommitInMainBranch(
        'org',
        'repo',
        'def456',
      );

      expect(result).toBe(true);
    });

    it('should return false for commit not in main branch', async () => {
      const mockResponse: AxiosResponse = {
        data: [{ name: 'feature-branch' }, { name: 'develop' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.isCommitInMainBranch(
        'org',
        'repo',
        'ghi789',
      );

      expect(result).toBe(false);
    });

    it('should handle API errors', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.isCommitInMainBranch('org', 'repo', 'error');

      expect(result).toBe(false);
    });
  });

  describe('getUserByEmail', () => {
    it('should find user by email', async () => {
      const mockSearchResponse: AxiosResponse = {
        data: {
          total_count: 1,
          items: [
            {
              login: 'developer123',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockUserResponse: AxiosResponse = {
        data: {
          login: 'developer123',
          email: 'dev@example.com',
          bio: 'Web3 developer | Wallet: 0x1234567890abcdef1234567890abcdef12345678',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get
        .mockReturnValueOnce(of(mockSearchResponse))
        .mockReturnValueOnce(of(mockUserResponse));

      const result = await service.getUserByEmail('dev@example.com');

      expect(result).not.toBeNull();
      expect(result?.username).toBe('developer123');
      expect(result?.email).toBe('dev@example.com');
      expect(result?.walletAddress).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
    });

    it('should handle user without wallet in bio', async () => {
      const mockSearchResponse: AxiosResponse = {
        data: {
          total_count: 1,
          items: [{ login: 'user456' }],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockUserResponse: AxiosResponse = {
        data: {
          login: 'user456',
          email: null,
          bio: 'Just a regular developer',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get
        .mockReturnValueOnce(of(mockSearchResponse))
        .mockReturnValueOnce(of(mockUserResponse));

      const result = await service.getUserByEmail('user@example.com');

      expect(result?.walletAddress).toBeUndefined();
      expect(result?.email).toBe('user@example.com');
    });

    it('should return null when user not found', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          total_count: 0,
          items: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should handle API errors', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.getUserByEmail('error@example.com');

      expect(result).toBeNull();
    });
  });

  describe('verifyContributionUrl', () => {
    it('should verify pull request URL', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          number: 123,
          user: { login: 'developer' },
          title: 'Test PR',
          state: 'closed',
          merged: true,
          merged_at: '2024-01-10T10:00:00Z',
          created_at: '2024-01-09T10:00:00Z',
          html_url: 'https://github.com/org/repo/pull/123',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.verifyContributionUrl(
        'https://github.com/org/repo/pull/123',
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('pull_request');
      expect(result?.id).toBe('123');
    });

    it('should verify commit URL', async () => {
      const mockCommitResponse: AxiosResponse = {
        data: {
          sha: 'abc123def456',
          author: { login: 'dev' },
          commit: {
            author: {
              name: 'Developer',
              email: 'dev@example.com',
              date: '2024-01-10T10:00:00Z',
            },
            message: 'Fix bug',
          },
          html_url: 'https://github.com/org/repo/commit/abc123def456',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockBranchesResponse: AxiosResponse = {
        data: [{ name: 'main' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get
        .mockReturnValueOnce(of(mockCommitResponse))
        .mockReturnValueOnce(of(mockBranchesResponse));

      const result = await service.verifyContributionUrl(
        'https://github.com/org/repo/commit/1234567890abcdef1234567890abcdef12345678',
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('commit');
      expect(result?.id).toBe('abc123def456');
    });

    it('should return null for invalid URL format', async () => {
      const result = await service.verifyContributionUrl(
        'https://github.com/org/repo/invalid/url',
      );

      expect(result).toBeNull();
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });

  describe('getRepositoryStats', () => {
    it('should get repository statistics', async () => {
      const mockRepoResponse: AxiosResponse = {
        data: {
          stargazers_count: 1500,
          forks_count: 250,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockContributorsResponse: AxiosResponse = {
        data: [
          { login: 'user1', contributions: 100 },
          { login: 'user2', contributions: 50 },
          { login: 'user3', contributions: 25 },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.get
        .mockReturnValueOnce(of(mockRepoResponse))
        .mockReturnValueOnce(of(mockContributorsResponse));

      const result = await service.getRepositoryStats('org', 'repo');

      expect(result).not.toBeNull();
      expect(result?.stars).toBe(1500);
      expect(result?.forks).toBe(250);
      expect(result?.contributors).toBe(3);
      expect(result?.commits).toBe(175);
    });

    it('should handle API errors', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('API error')));

      const result = await service.getRepositoryStats('org', 'repo');

      expect(result).toBeNull();
    });
  });
});
