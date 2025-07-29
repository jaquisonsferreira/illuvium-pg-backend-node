import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface GitHubContributionInfo {
  type: 'pull_request' | 'commit';
  id: string;
  author: string;
  authorEmail: string;
  repository: string;
  title: string;
  status: 'open' | 'closed' | 'merged';
  mergedAt?: Date;
  createdAt: Date;
  url: string;
}

interface GitHubUserInfo {
  username: string;
  email: string;
  walletAddress?: string;
}

@Injectable()
export class GitHubVerificationService {
  private readonly logger = new Logger(GitHubVerificationService.name);
  private readonly apiUrl = 'https://api.github.com';
  private readonly headers: Record<string, string>;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const token = this.configService.get('GITHUB_API_TOKEN');
    this.headers = {
      Accept: 'application/vnd.github.v3+json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async verifyPullRequest(
    owner: string,
    repo: string,
    pullNumber: string,
  ): Promise<GitHubContributionInfo | null> {
    try {
      const url = `${this.apiUrl}/repos/${owner}/${repo}/pulls/${pullNumber}`;

      const response = await firstValueFrom(
        this.httpService.get<any>(url, { headers: this.headers }),
      );

      const pr = response.data;

      return {
        type: 'pull_request',
        id: pr.number.toString(),
        author: pr.user.login,
        authorEmail: pr.user.email || '',
        repository: `${owner}/${repo}`,
        title: pr.title,
        status: pr.merged ? 'merged' : pr.state,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
        createdAt: new Date(pr.created_at),
        url: pr.html_url,
      };
    } catch (error) {
      this.logger.error(`Error verifying pull request:`, error);
      return null;
    }
  }

  async verifyCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<GitHubContributionInfo | null> {
    try {
      const url = `${this.apiUrl}/repos/${owner}/${repo}/commits/${commitSha}`;

      const response = await firstValueFrom(
        this.httpService.get<any>(url, { headers: this.headers }),
      );

      const commit = response.data;

      const isInMainBranch = await this.isCommitInMainBranch(
        owner,
        repo,
        commitSha,
      );

      return {
        type: 'commit',
        id: commit.sha,
        author: commit.author?.login || commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        repository: `${owner}/${repo}`,
        title: commit.commit.message.split('\n')[0],
        status: isInMainBranch ? 'merged' : 'open',
        createdAt: new Date(commit.commit.author.date),
        url: commit.html_url,
      };
    } catch (error) {
      this.logger.error(`Error verifying commit:`, error);
      return null;
    }
  }

  async isCommitInMainBranch(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<boolean> {
    try {
      const branchesUrl = `${this.apiUrl}/repos/${owner}/${repo}/commits/${commitSha}/branches-where-head`;

      const response = await firstValueFrom(
        this.httpService.get<any[]>(branchesUrl, { headers: this.headers }),
      );

      const branches = response.data;
      return branches.some(
        (branch: any) => branch.name === 'main' || branch.name === 'master',
      );
    } catch (error) {
      this.logger.error(`Error checking commit branches:`, error);
      return false;
    }
  }

  async getUserByEmail(email: string): Promise<GitHubUserInfo | null> {
    try {
      const searchUrl = `${this.apiUrl}/search/users?q=${email}+in:email`;

      const response = await firstValueFrom(
        this.httpService.get<{ total_count: number; items: any[] }>(searchUrl, {
          headers: this.headers,
        }),
      );

      if (response.data.total_count > 0) {
        const user = response.data.items[0];

        const userDetailsUrl = `${this.apiUrl}/users/${user.login}`;
        const detailsResponse = await firstValueFrom(
          this.httpService.get<any>(userDetailsUrl, { headers: this.headers }),
        );

        const details = detailsResponse.data;

        const walletAddress = this.extractWalletFromBio(details.bio);

        return {
          username: user.login,
          email: details.email || email,
          walletAddress,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting user by email:`, error);
      return null;
    }
  }

  async verifyContributionUrl(
    url: string,
  ): Promise<GitHubContributionInfo | null> {
    const pullRequestMatch = url.match(
      /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
    );
    if (pullRequestMatch) {
      const [, owner, repo, pullNumber] = pullRequestMatch;
      return this.verifyPullRequest(owner, repo, pullNumber);
    }

    const commitMatch = url.match(
      /github\.com\/([^\/]+)\/([^\/]+)\/commit\/([a-f0-9]{40})/,
    );
    if (commitMatch) {
      const [, owner, repo, commitSha] = commitMatch;
      return this.verifyCommit(owner, repo, commitSha);
    }

    this.logger.warn(`Invalid GitHub URL format: ${url}`);
    return null;
  }

  private extractWalletFromBio(bio: string | null): string | undefined {
    if (!bio) return undefined;

    const walletMatch = bio.match(/0x[a-fA-F0-9]{40}/);
    return walletMatch ? walletMatch[0] : undefined;
  }

  async getRepositoryStats(
    owner: string,
    repo: string,
  ): Promise<{
    stars: number;
    forks: number;
    contributors: number;
    commits: number;
  } | null> {
    try {
      const repoUrl = `${this.apiUrl}/repos/${owner}/${repo}`;
      const contributorsUrl = `${this.apiUrl}/repos/${owner}/${repo}/contributors`;

      const [repoResponse, contributorsResponse] = await Promise.all([
        firstValueFrom(
          this.httpService.get<any>(repoUrl, { headers: this.headers }),
        ),
        firstValueFrom(
          this.httpService.get<any[]>(contributorsUrl, {
            headers: this.headers,
          }),
        ),
      ]);

      return {
        stars: repoResponse.data.stargazers_count,
        forks: repoResponse.data.forks_count,
        contributors: contributorsResponse.data.length,
        commits: contributorsResponse.data.reduce(
          (sum: number, contributor: any) => sum + contributor.contributions,
          0,
        ),
      };
    } catch (error) {
      this.logger.error(`Error getting repository stats:`, error);
      return null;
    }
  }
}
